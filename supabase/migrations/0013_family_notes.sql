-- Family-to-senior text notes. One-directional (family -> senior), same
-- shape as shared_media (0009) minus the storage bucket -- the senior reads
-- or hears these, but doesn't reply from this surface (they'd use the AI
-- chat or a call for that).

create table family_notes (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references profiles(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  viewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index on family_notes (senior_id, created_at desc);

alter table family_notes enable row level security;

create policy "family_notes_select_senior" on family_notes
  for select using (senior_id = auth.uid());

create policy "family_notes_select_linked_family" on family_notes
  for select using (is_linked_family_member(senior_id));

-- Sending goes through the send-note Edge Function via the service role
-- (same reasoning as shared_media's insert policy) so the accompanying
-- push notification stays server-side; the senior marking a note as viewed
-- is the only direct client write.
create policy "family_notes_update_viewed_senior" on family_notes
  for update using (senior_id = auth.uid())
  with check (senior_id = auth.uid());

-- So the senior's home screen can announce a new note immediately while the
-- app is open, same as shared_media (0010).
alter publication supabase_realtime add table family_notes;
