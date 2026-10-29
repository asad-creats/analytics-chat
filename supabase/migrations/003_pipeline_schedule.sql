-- Keeps the demo data moving: every 15 minutes new leads arrive and the team
-- makes calls, so the same question gives a fresher answer later in the day.
-- Needs the pg_cron extension (Supabase: Database -> Extensions -> pg_cron).
--
-- When a real CRM sync replaces the demo data, unschedule this:
--   select cron.unschedule('pipeline-simulate');

create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'pipeline-simulate';
select cron.schedule('pipeline-simulate', '*/15 * * * *', 'select pipeline.simulate_tick()');

-- Rebuild the dataset weekly so it doesn't drift too far from the seed's shape.
select cron.unschedule(jobid) from cron.job where jobname = 'pipeline-reseed';
select cron.schedule('pipeline-reseed', '17 9 * * 1', 'select pipeline.seed()');
