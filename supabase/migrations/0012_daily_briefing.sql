-- Daily briefing: greets the senior by time of day and, once per day,
-- weaves in weather/news/reminders through the companion's own voice
-- (see chat/index.ts's briefing branch) -- family controls which
-- categories are included and the senior's location for weather.

alter table companion_settings add column location_zip text;
alter table companion_settings add column briefing_weather boolean not null default true;
alter table companion_settings add column briefing_news boolean not null default false;
alter table companion_settings add column briefing_reminders boolean not null default true;

-- Family-managed reminders (birthdays, anniversaries, medication/to-dos)
-- surfaced in the daily briefing when due. 'yearly' repeats every year on
-- month/day (year in remind_on is ignored); 'daily' has no date at all,
-- always due; 'once' fires only on its exact remind_on date.
create table reminders (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  recurrence text not null check (recurrence in ('yearly', 'daily', 'once')),
  remind_on date,
  created_at timestamptz not null default now(),
  constraint reminders_date_required check (recurrence = 'daily' or remind_on is not null)
);

create index on reminders (senior_id);

alter table reminders enable row level security;

create policy "reminders_select_senior" on reminders
  for select using (senior_id = auth.uid());

create policy "reminders_all_linked_family" on reminders
  for all using (is_linked_family_member(senior_id))
  with check (is_linked_family_member(senior_id));
