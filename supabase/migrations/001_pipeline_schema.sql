-- Pipeline: CRM data the assistant answers from.
-- Shaped like Follow Up Boss (people, calls/texts/emails, appointments, deals)
-- so a real FUB sync can write into the same tables later.
--
-- Run in the Supabase SQL editor, then 002 and 003.

create schema if not exists pipeline;

create table if not exists pipeline.agents (
  id          serial primary key,
  name        text not null unique,
  role        text not null default 'Agent',
  active      boolean not null default true,
  hired_on    date
);

create table if not exists pipeline.leads (
  id            bigserial primary key,
  name          text not null,
  email         text,
  phone         text,
  source        text not null,
  stage         text not null default 'New'
    check (stage in ('New', 'Attempted', 'Contacted', 'Appointment set', 'Showing',
                     'Offer', 'Under contract', 'Closed', 'Lost')),
  agent_id      int references pipeline.agents (id),
  city          text,
  price_min     int,
  price_max     int,
  is_duplicate  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists pipeline.activities (
  id                bigserial primary key,
  lead_id           bigint not null references pipeline.leads (id) on delete cascade,
  agent_id          int references pipeline.agents (id),
  type              text not null check (type in ('call', 'text', 'email', 'note')),
  direction         text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  outcome           text,
  duration_seconds  int,
  body              text,
  occurred_at       timestamptz not null default now(),
  -- Full-text search over notes, texts and emails.
  search            tsvector generated always as (to_tsvector('english', coalesce(body, ''))) stored
);

create table if not exists pipeline.appointments (
  id             bigserial primary key,
  lead_id        bigint not null references pipeline.leads (id) on delete cascade,
  agent_id       int references pipeline.agents (id),
  kind           text not null check (kind in ('consultation', 'showing', 'listing')),
  status         text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'no-show', 'cancelled')),
  scheduled_for  timestamptz not null,
  created_at     timestamptz not null default now()
);

create table if not exists pipeline.deals (
  id             bigserial primary key,
  lead_id        bigint references pipeline.leads (id) on delete set null,
  agent_id       int references pipeline.agents (id),
  address        text not null,
  city           text,
  side           text not null check (side in ('buyer', 'seller')),
  price          numeric(12, 2) not null,
  commission     numeric(12, 2),
  stage          text not null
    check (stage in ('Under contract', 'Clear to close', 'Closed', 'Fell through')),
  contract_date  date,
  close_date     date
);

create table if not exists pipeline.deal_deadlines (
  id        bigserial primary key,
  deal_id   bigint not null references pipeline.deals (id) on delete cascade,
  kind      text not null check (kind in ('Inspection', 'Financing', 'Appraisal', 'Title')),
  due_date  date not null,
  done      boolean not null default false
);

-- When the data was last refreshed (by the demo simulator or a CRM sync).
create table if not exists pipeline.sync_state (
  id          int primary key default 1 check (id = 1),
  source      text not null default 'demo',
  timezone    text not null default 'America/New_York',
  synced_at   timestamptz not null default now()
);
insert into pipeline.sync_state (id) values (1) on conflict do nothing;

-- Free-tier quota: questions per visitor per day. Visitors are anonymous, so
-- they're keyed by a salted hash of their IP, never the IP itself.
create table if not exists pipeline.ask_usage (
  usage_date   date not null default current_date,
  client_hash  text not null,
  count        int  not null default 0,
  primary key (usage_date, client_hash)
);

create index if not exists leads_created_idx on pipeline.leads (created_at);
create index if not exists leads_agent_idx on pipeline.leads (agent_id);
create index if not exists activities_lead_idx on pipeline.activities (lead_id, occurred_at);
create index if not exists activities_search_idx on pipeline.activities using gin (search);
create index if not exists appointments_lead_idx on pipeline.appointments (lead_id);
create index if not exists deals_close_idx on pipeline.deals (close_date);

-- The assistant's queries run as this role, inside a read-only transaction.
-- It can read the CRM tables and nothing else: no writes, no quota table,
-- and no access to other schemas (Tally, Quorum, auth).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pipeline_reader') then
    create role pipeline_reader nologin;
  end if;
end
$$;

grant pipeline_reader to current_user;
grant usage on schema pipeline to pipeline_reader;
grant select on pipeline.agents, pipeline.leads, pipeline.activities, pipeline.appointments,
  pipeline.deals, pipeline.deal_deadlines, pipeline.sync_state to pipeline_reader;
revoke all on pipeline.ask_usage from pipeline_reader;
alter role pipeline_reader set statement_timeout = '5s';

-- ---------------------------------------------------------------------------
-- Functions the ask endpoint calls (through the API, with the service key).
-- Only service_role may execute them; visitors can't call them directly.
-- ---------------------------------------------------------------------------

-- Runs one read-only SELECT for the assistant and returns up to 200 rows as JSON.
-- Owned by pipeline_reader and SECURITY DEFINER, so the query runs with that
-- role's rights, and Postgres forbids SET ROLE / set_config('role') inside it.
create or replace function public.pipeline_run_query(q text)
returns jsonb
language plpgsql
security definer
set search_path = pipeline
set statement_timeout = '5s'
as $$
declare
  result jsonb;
  cleaned text := regexp_replace(btrim(q), ';\s*$', '');
begin
  if cleaned !~* '^\s*(select|with)\s' then
    raise exception 'Only SELECT queries are allowed';
  end if;
  if position(';' in cleaned) > 0 then
    raise exception 'Only one statement is allowed';
  end if;
  -- The function-level timeout can't interrupt a statement already running, so
  -- refuse the functions that stall or reach outside the data.
  if cleaned ~* '\m(pg_sleep\w*|pg_terminate_backend|pg_cancel_backend|pg_advisory\w*|pg_read\w*|pg_ls\w*|lo_\w+|dblink\w*|set_config)\s*\(' then
    raise exception 'That function is not allowed';
  end if;
  -- As a subquery, data-modifying CTEs are rejected by Postgres itself.
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (%s) s limit 200) t', cleaned)
    into result;
  return result;
end;
$$;

-- Facts the assistant gets before every question: what exists and how fresh it is.
create or replace function public.pipeline_overview()
returns jsonb
language sql
security definer
set search_path = pipeline
stable
as $$
  select jsonb_build_object(
    'now', now(),
    'timezone', (select timezone from sync_state),
    'synced_at', (select synced_at from sync_state),
    'data_source', (select source from sync_state),
    'lead_count', (select count(*) from leads where not is_duplicate),
    'first_lead_at', (select min(created_at) from leads),
    'agents', (select jsonb_agg(name order by name) from agents where active),
    'sources', (select jsonb_agg(distinct source) from leads),
    'lead_stages', (select jsonb_agg(distinct stage) from leads),
    'deal_stages', (select jsonb_agg(distinct stage) from deals)
  );
$$;

alter function public.pipeline_run_query(text) owner to pipeline_reader;
alter function public.pipeline_overview() owner to pipeline_reader;

-- Free tier: counts a question against the visitor's and the whole site's daily
-- caps. Returns whether it's allowed plus the visitor's usage.
create or replace function public.pipeline_consume_quota(client text, per_client int, site_total int)
returns jsonb
language plpgsql
security definer
set search_path = pipeline
as $$
declare
  used_client int;
  used_site   int;
begin
  -- One question at a time per day row, so two tabs can't both slip under the cap.
  perform pg_advisory_xact_lock(hashtext('pipeline_quota'));
  select coalesce(sum(count), 0) into used_site from ask_usage where usage_date = current_date;
  select coalesce(max(count), 0) into used_client from ask_usage
   where usage_date = current_date and client_hash = client;

  if used_client >= per_client or used_site >= site_total then
    return jsonb_build_object('allowed', false, 'used', used_client, 'limit', per_client,
                              'site_full', used_site >= site_total);
  end if;

  insert into ask_usage (usage_date, client_hash, count) values (current_date, client, 1)
  on conflict (usage_date, client_hash) do update set count = ask_usage.count + 1;
  return jsonb_build_object('allowed', true, 'used', used_client + 1, 'limit', per_client);
end;
$$;

revoke all on function public.pipeline_run_query(text) from public;
revoke all on function public.pipeline_overview() from public;
revoke all on function public.pipeline_consume_quota(text, int, int) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.pipeline_run_query(text) to service_role;
    grant execute on function public.pipeline_overview() to service_role;
    grant execute on function public.pipeline_consume_quota(text, int, int) to service_role;
  end if;
end
$$;
