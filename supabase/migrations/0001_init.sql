-- SilverBeam MVP schema + RLS
-- Beta note: senior_family_links rows are created manually by the founder
-- (via the Supabase SQL editor/dashboard) for the 10 founding families —
-- there is no self-serve invite flow yet, so no client-facing insert policy
-- is defined for that table in this migration.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('senior','family')),
  full_name text not null,
  phone text,
  avatar_url text,
  timezone text default 'America/Detroit',
  created_at timestamptz not null default now()
);

create table senior_family_links (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references profiles(id) on delete cascade,
  family_member_id uuid not null references profiles(id) on delete cascade,
  relationship text,
  is_emergency_contact boolean not null default false,
  created_at timestamptz not null default now(),
  unique (senior_id, family_member_id)
);

create table check_ins (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references profiles(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  mood text check (mood in ('great','okay','not_great','rough')),
  summary text,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Raw transcript. Senior-only + service role. Never exposed to family
-- clients — family sees only check_ins.summary and escalation_events.
create table conversation_messages (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references profiles(id) on delete cascade,
  check_in_id uuid references check_ins(id) on delete set null,
  role text not null check (role in ('senior','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table escalation_events (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references profiles(id) on delete cascade,
  check_in_id uuid references check_ins(id) on delete set null,
  conversation_message_id uuid references conversation_messages(id) on delete set null,
  severity text not null check (severity in ('low','medium','high')),
  trigger_reason text,
  detected_keywords text[],
  notified_family_member_id uuid references profiles(id),
  notification_method text check (notification_method in ('push','sms','both')),
  notification_sent_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid references profiles(id),
  resolved boolean not null default false,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  token text not null,
  platform text,
  created_at timestamptz not null default now(),
  unique (profile_id, token)
);

create index on senior_family_links (family_member_id);
create index on check_ins (senior_id, occurred_at desc);
create index on conversation_messages (senior_id, created_at);
create index on escalation_events (senior_id, created_at desc);
create index on push_tokens (profile_id);

-- ---------------------------------------------------------------------
-- Helper: is the current authenticated user a family member linked to
-- target_senior_id? security definer so it can read senior_family_links
-- regardless of the caller's own RLS visibility into that table.
-- ---------------------------------------------------------------------
create or replace function is_linked_family_member(target_senior_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from senior_family_links
    where senior_id = target_senior_id
      and family_member_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table senior_family_links enable row level security;
alter table check_ins enable row level security;
alter table conversation_messages enable row level security;
alter table escalation_events enable row level security;
alter table push_tokens enable row level security;

-- profiles: read/update your own row; family can read their linked senior's row.
-- Self-serve insert is restricted to role='family' — senior accounts are
-- always provisioned by the founder (service role) during the beta, never
-- self-signed-up, since seniors don't go through an app store signup flow.
create policy "profiles_insert_self_family" on profiles
  for insert with check (id = auth.uid() and role = 'family');

create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());

create policy "profiles_select_linked_senior" on profiles
  for select using (role = 'senior' and is_linked_family_member(id));

create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

-- senior_family_links: senior and linked family can see the link rows that
-- involve them. No insert/update/delete policy — managed by the founder via
-- the service role during the beta.
create policy "links_select_involved" on senior_family_links
  for select using (senior_id = auth.uid() or family_member_id = auth.uid());

-- check_ins: senior has full CRUD on own rows; linked family can read only
create policy "checkins_all_own_senior" on check_ins
  for all using (senior_id = auth.uid()) with check (senior_id = auth.uid());

create policy "checkins_select_linked_family" on check_ins
  for select using (is_linked_family_member(senior_id));

-- conversation_messages: senior can read/write their own transcript.
-- Deliberately no family-facing policy — family never sees raw transcripts.
create policy "messages_all_own_senior" on conversation_messages
  for all using (senior_id = auth.uid()) with check (senior_id = auth.uid());

-- escalation_events: senior + linked family can read; family can acknowledge/
-- resolve. Inserts are NOT allowed from client roles — only the chat Edge
-- Function (using the service role key, which bypasses RLS) creates rows,
-- so a compromised client can't fabricate or suppress an escalation.
create policy "escalations_select_senior" on escalation_events
  for select using (senior_id = auth.uid());

create policy "escalations_select_linked_family" on escalation_events
  for select using (is_linked_family_member(senior_id));

create policy "escalations_update_linked_family" on escalation_events
  for update using (is_linked_family_member(senior_id))
  with check (is_linked_family_member(senior_id));

-- push_tokens: manage only your own tokens
create policy "push_tokens_all_own" on push_tokens
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
