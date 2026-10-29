-- Pipeline demo data: a realistic, fake real estate team.
-- Dates are relative to today, so the data never goes stale.
-- `pipeline.seed()` rebuilds everything; `pipeline.simulate_tick()` (scheduled
-- in 003) keeps adding leads, calls and stage changes so answers move.

create or replace function pipeline.pick(options text[])
returns text language sql volatile as $$
  select options[1 + floor(random() * array_length(options, 1))::int];
$$;

-- Picks options[i] with probability weights[i] / sum(weights).
create or replace function pipeline.pick_weighted(options text[], weights numeric[])
returns text language plpgsql volatile as $$
declare
  total numeric := 0;
  roll  numeric;
  i     int;
begin
  for i in 1 .. array_length(weights, 1) loop
    total := total + weights[i];
  end loop;
  roll := random() * total;
  for i in 1 .. array_length(weights, 1) loop
    roll := roll - weights[i];
    if roll <= 0 then
      return options[i];
    end if;
  end loop;
  return options[array_length(options, 1)];
end;
$$;

-- Inserts one lead. With `with_history`, also writes the calls, texts, notes,
-- appointments and deal it would have accumulated between created_at and now.
create or replace function pipeline.add_lead(created timestamptz, with_history boolean)
returns bigint language plpgsql volatile as $$
declare
  first_names text[] := array['Dana','Luis','Ava','Kim','Sam','Erin','Noah','Maya','Owen','Leah','Raj','Chloe',
    'Marco','Nina','Ethan','Grace','Omar','Lily','Ben','Zoe','Ian','Ruth','Theo','Ivy','Caleb','Hana','Jon','Tessa',
    'Victor','Mila','Andre','Sofia','Ryan','Paige','Hugo','Nora','Felix','June','Kai','Rosa'];
  last_names text[] := array['Whitfield','Ortega','Brooks','Nguyen','Patel','Cole','Harper','Singh','Reed','Moss',
    'Kaur','Bennett','Rossi','Ford','Hale','Lowe','Farah','Chen','Price','Grant','Duval','Ward','Byrne','Lam',
    'Ellis','Mori','Quinn','Shaw','Vance','Novak','Pierce','Silva','Knox','Wells','Abbott','Ruiz','Stone','Dyer'];
  cities text[] := array['Raleigh','Durham','Cary','Apex','Chapel Hill','Wake Forest','Holly Springs'];
  streets text[] := array['Larkspur Ln','Quarry Bend Dr','Willow Oak Ct','Ashby Ridge Rd','Fenwick Pl','Hawthorne St',
    'Briar Creek Dr','Saddle Ridge Way','Linden Ave','Millbrook Rd','Cedar Fork Ln','Juniper Hill Ct'];
  notes text[] := array[
    'Wants 3 bed under 450k near good schools.',
    'Pre-approved with local credit union, ready to tour this weekend.',
    'Relocating for work in January, needs a short closing.',
    'First-time buyer, nervous about rates. Send the payment calculator.',
    'Selling current home first; wants a valuation.',
    'Asked about HOA fees in the newer subdivisions.',
    'Not ready until spring. Check back in March.',
    'Wants a big yard for two dogs, open to a longer commute.',
    'Investor looking at small multifamily, cash buyer.',
    'Spouse decides; set a call with both of them.',
    'Unhappy with last agent, wants faster replies.',
    'Downsizing, wants single-level living.'];
  replies text[] := array['Yes, Saturday works.','Can you send more listings like that one?','We decided to wait a bit.',
    'What are the taxes on that one?','Thanks, talk tomorrow.','Is it still available?'];

  lead_id    bigint;
  agent      int;
  source     text;
  stage      text;
  close_p    numeric;
  age_days   numeric := extract(epoch from now() - created) / 86400;
  local_hour int;
  evening    boolean;
  delay_min  numeric;
  first_at   timestamptz;
  t          timestamptz;
  roll       numeric;
  extra      int;
  i          int;
  price      numeric;
  deal_id    bigint;
  close_on   date;
begin
  source := pipeline.pick_weighted(
    array['Zillow','Website (IDX)','Facebook ads','Referral','Open house','Realtor.com'],
    array[30, 22, 18, 12, 10, 8]);
  agent := (select id from pipeline.agents where active
            order by random() * (case name when 'Priya Shah' then 0.6 when 'Jordan Reyes' then 0.7 else 1 end)
            limit 1);
  close_p := case source when 'Referral' then 0.21 when 'Zillow' then 0.07 when 'Realtor.com' then 0.06
                         when 'Website (IDX)' then 0.05 when 'Open house' then 0.04 else 0.02 end;

  -- Where the lead is now depends on how long it's been in the funnel.
  roll := random();
  if not with_history then
    stage := 'New';
  elsif age_days < 2 then
    stage := pipeline.pick(array['New','Attempted','Contacted']);
  elsif age_days > 35 and roll < close_p then
    stage := 'Closed';
  elsif age_days > 12 and roll < close_p * 1.7 then
    stage := 'Under contract';
  elsif roll < close_p * 1.7 + 0.05 then
    stage := 'Offer';
  elsif roll < close_p * 1.7 + 0.13 then
    stage := 'Showing';
  elsif roll < close_p * 1.7 + 0.22 then
    stage := 'Appointment set';
  elsif roll > 0.72 then
    stage := 'Lost';
  else
    stage := pipeline.pick(array['Attempted','Contacted','Contacted']);
  end if;

  insert into pipeline.leads (name, email, phone, source, stage, agent_id, city, price_min, price_max,
                              is_duplicate, created_at, updated_at)
  values (
    pipeline.pick(first_names) || ' ' || pipeline.pick(last_names),
    null, '(919) 555-' || lpad((floor(random() * 10000))::int::text, 4, '0'),
    source, stage, agent, pipeline.pick(cities),
    (250 + floor(random() * 30) * 10) * 1000, null,
    random() < 0.015, created, created)
  returning id into lead_id;

  update pipeline.leads
     set email = lower(replace(name, ' ', '.')) || lead_id || '@example.com',
         price_max = price_min + (50 + floor(random() * 15) * 10) * 1000
   where id = lead_id;

  if not with_history then
    return lead_id;
  end if;

  -- First response. Evening leads wait longer, and in the month before last
  -- evening coverage slipped badly; that's the story the data tells.
  local_hour := extract(hour from created at time zone 'America/New_York');
  evening := local_hour >= 18 or local_hour < 8;
  delay_min := case when evening then 8 + random() * 30 else 3 + random() * 12 end;
  if evening and created between date_trunc('month', now()) - interval '1 month'
                              and date_trunc('month', now()) then
    delay_min := delay_min + 25 + random() * 70;
  end if;
  first_at := created + delay_min * interval '1 minute';

  -- A few of this week's leads still have no call logged.
  if age_days < 4 and random() < 0.16 then
    return lead_id;
  end if;
  if first_at > now() then
    return lead_id;
  end if;

  insert into pipeline.activities (lead_id, agent_id, type, direction, outcome, duration_seconds, occurred_at)
  values (lead_id, agent, case when random() < 0.75 then 'call' else 'text' end, 'outbound',
          pipeline.pick(array['connected','voicemail','no answer','connected']),
          (30 + random() * 400)::int, first_at);

  -- Follow-ups over the following weeks.
  extra := case when stage in ('New','Attempted') then floor(random() * 2)::int
                when stage = 'Lost' then 1 + floor(random() * 3)::int
                else 2 + floor(random() * 6)::int end;
  t := first_at;
  for i in 1 .. extra loop
    t := t + (6 + random() * 90) * interval '1 hour';
    exit when t > now();
    roll := random();
    if roll < 0.45 then
      insert into pipeline.activities (lead_id, agent_id, type, direction, outcome, duration_seconds, occurred_at)
      values (lead_id, agent, 'call', 'outbound',
              pipeline.pick(array['connected','voicemail','no answer']), (20 + random() * 600)::int, t);
    elsif roll < 0.7 then
      insert into pipeline.activities (lead_id, agent_id, type, direction, body, occurred_at)
      values (lead_id, agent, 'text', 'outbound', 'Following up on the homes I sent over.', t);
      if random() < 0.5 then
        insert into pipeline.activities (lead_id, agent_id, type, direction, body, occurred_at)
        values (lead_id, agent, 'text', 'inbound', pipeline.pick(replies), t + interval '40 minutes');
      end if;
    elsif roll < 0.85 then
      insert into pipeline.activities (lead_id, agent_id, type, direction, body, occurred_at)
      values (lead_id, agent, 'email', 'outbound', 'New listings matching your search.', t);
    else
      insert into pipeline.activities (lead_id, agent_id, type, direction, body, occurred_at)
      values (lead_id, agent, 'note', 'outbound', pipeline.pick(notes), t);
    end if;
  end loop;

  if random() < 0.6 then
    insert into pipeline.activities (lead_id, agent_id, type, direction, body, occurred_at)
    values (lead_id, agent, 'note', 'outbound', pipeline.pick(notes), least(first_at + interval '10 minutes', now()));
  end if;

  -- Appointments for anyone who got that far.
  if stage in ('Appointment set','Showing','Offer','Under contract','Closed') then
    t := least(first_at + (1 + random() * 6) * interval '1 day', now() + interval '5 days');
    insert into pipeline.appointments (lead_id, agent_id, kind, status, scheduled_for, created_at)
    values (lead_id, agent, 'consultation',
            case when t > now() then 'scheduled' when random() < 0.12 then 'no-show' else 'completed' end,
            t, first_at + interval '1 hour');
    if stage <> 'Appointment set' then
      for i in 1 .. 1 + floor(random() * 3)::int loop
        t := t + (2 + random() * 8) * interval '1 day';
        insert into pipeline.appointments (lead_id, agent_id, kind, status, scheduled_for, created_at)
        values (lead_id, agent, 'showing', case when t > now() then 'scheduled' else 'completed' end,
                t, t - interval '2 days');
      end loop;
    end if;
  end if;

  -- Deals.
  if stage in ('Under contract','Closed') then
    price := (280 + floor(random() * 55) * 10) * 1000;
    if stage = 'Closed' then
      close_on := least((created + (30 + random() * 60) * interval '1 day')::date, current_date - 1);
    else
      close_on := current_date + (2 + floor(random() * 28))::int;
    end if;
    insert into pipeline.deals (lead_id, agent_id, address, city, side, price, commission, stage,
                                contract_date, close_date)
    values (lead_id, agent,
            (10 + floor(random() * 1900))::int || ' ' || pipeline.pick(streets),
            (select city from pipeline.leads where id = lead_id),
            case when random() < 0.8 then 'buyer' else 'seller' end,
            price, round(price * 0.025, 2),
            case when stage = 'Closed' then 'Closed'
                 when close_on - current_date < 6 and random() < 0.5 then 'Clear to close'
                 else 'Under contract' end,
            close_on - (25 + floor(random() * 15))::int, close_on)
    returning id into deal_id;

    if stage = 'Under contract' then
      insert into pipeline.deal_deadlines (deal_id, kind, due_date, done)
      select deal_id, k.kind, due, due < current_date
        from (values ('Inspection', 0.25), ('Appraisal', 0.5), ('Financing', 0.7), ('Title', 0.9)) as k(kind, frac),
             lateral (select close_on - 35 + round(35 * k.frac)::int as due) d;
    end if;
  end if;

  if random() < 0.02 then
    insert into pipeline.deals (agent_id, address, city, side, price, stage, contract_date, close_date)
    values (agent, (10 + floor(random() * 1900))::int || ' ' || pipeline.pick(streets), pipeline.pick(cities),
            'buyer', (300 + floor(random() * 40) * 10) * 1000, 'Fell through',
            (created + interval '20 days')::date, (created + interval '50 days')::date);
  end if;

  return lead_id;
end;
$$;

-- Rebuilds the whole demo dataset.
create or replace function pipeline.seed(lead_count int default 420, days int default 150)
returns void language plpgsql volatile as $$
declare
  i int;
begin
  truncate pipeline.deal_deadlines, pipeline.deals, pipeline.appointments, pipeline.activities,
           pipeline.leads, pipeline.agents restart identity cascade;

  insert into pipeline.agents (name, role, hired_on) values
    ('Priya Shah', 'Agent', current_date - 900),
    ('Jordan Reyes', 'Agent', current_date - 420),
    ('Marcus Bell', 'Agent', current_date - 1300),
    ('Elena Park', 'Agent', current_date - 700),
    ('Sam Okafor', 'Agent', current_date - 250),
    ('Dana Lee', 'Agent', current_date - 1600),
    ('Chris Wong', 'Agent', current_date - 520),
    ('Aisha Khan', 'Agent', current_date - 180),
    ('Tom Miller', 'ISA', current_date - 1000);

  for i in 1 .. lead_count loop
    -- Lead flow grows a little over time.
    perform pipeline.add_lead(now() - (power(random(), 1.15) * days) * interval '1 day', true);
  end loop;

  update pipeline.sync_state set synced_at = now(), source = 'demo';
end;
$$;

-- One step of "the team keeps working": new leads arrive, untouched leads get
-- their first call, and a few leads move down the funnel.
create or replace function pipeline.simulate_tick()
returns void language plpgsql volatile as $$
declare
  local_hour int := extract(hour from now() at time zone 'America/New_York');
  r record;
begin
  -- New leads: busier in the day than overnight.
  for r in select generate_series(1, case when local_hour between 8 and 21 then floor(random() * 3)::int
                                          else floor(random() * 1.5)::int end) loop
    perform pipeline.add_lead(now() - random() * interval '15 minutes', false);
  end loop;

  -- First calls for leads still waiting.
  for r in
    select l.id, l.agent_id from pipeline.leads l
     where l.created_at > now() - interval '3 days'
       and not exists (select 1 from pipeline.activities a where a.lead_id = l.id and a.direction = 'outbound')
  loop
    if random() < 0.35 then
      insert into pipeline.activities (lead_id, agent_id, type, direction, outcome, duration_seconds, occurred_at)
      values (r.id, r.agent_id, 'call', 'outbound', pipeline.pick(array['connected','voicemail','no answer']),
              (30 + random() * 300)::int, now());
      update pipeline.leads set stage = 'Attempted', updated_at = now() where id = r.id and stage = 'New';
    end if;
  end loop;

  -- A handful of leads progress.
  update pipeline.leads
     set stage = case stage when 'Attempted' then 'Contacted' when 'Contacted' then 'Appointment set'
                            when 'Appointment set' then 'Showing' else stage end,
         updated_at = now()
   where id in (select id from pipeline.leads
                 where stage in ('Attempted', 'Contacted', 'Appointment set')
                 order by random() limit 2);

  update pipeline.sync_state set synced_at = now();
end;
$$;

select pipeline.seed();
