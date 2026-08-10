-- Call log, so the family "History" tab can show calls alongside alerts and
-- check-ins (previously only showed escalation_events). Written by the
-- create-call Edge Function (service role) when a senior starts a call.

create table call_events (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references profiles(id) on delete cascade,
  room_name text not null,
  started_at timestamptz not null default now()
);

create index on call_events (senior_id, started_at desc);

alter table call_events enable row level security;

create policy "call_events_select_senior" on call_events
  for select using (senior_id = auth.uid());

create policy "call_events_select_linked_family" on call_events
  for select using (is_linked_family_member(senior_id));
