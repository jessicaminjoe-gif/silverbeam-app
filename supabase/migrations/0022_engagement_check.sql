-- Schema + scheduling for the daily engagement check: (a) alert family if a
-- senior has gone quiet (no check-in) longer than a family-set threshold,
-- and (b) nudge an individual family member who hasn't reached out (call,
-- photo, or note) in a week. Both run from one scheduled Edge Function
-- (daily-engagement-check) invoked once a day via pg_cron -- the first
-- background/scheduled work in this app; everything else so far is
-- triggered by a user action.

alter table companion_settings add column inactivity_alert_days integer;
alter table companion_settings add column last_inactivity_alert_sent_at timestamptz;
alter table senior_family_links add column last_reengagement_nudge_sent_at timestamptz;

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- The Edge Function's URL needs the service role key to authenticate as
-- itself (verify_jwt stays on, same as every other function -- a service
-- role key is itself a valid signed JWT). Storing it in Vault, looked up by
-- name at cron-execution time, keeps the actual secret value out of this
-- migration file (and out of git) -- it's provisioned separately via
-- `select vault.create_secret(...)` run directly against the project, not
-- committed anywhere. See README for that one-time setup step.
select cron.schedule(
  'daily-engagement-check',
  '0 15 * * *', -- 15:00 UTC daily (~10-11am US Eastern)
  $$
  select net.http_post(
    url := 'https://dxgijqbyzsxqvukpaamq.supabase.co/functions/v1/daily-engagement-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
