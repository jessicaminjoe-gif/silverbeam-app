-- Companion customization: family names the companion, sets what it calls
-- the senior, picks its voice, and can set the senior's photo. All
-- family-managed (per the "Family Options" feedback), senior can read but
-- not write.

create table companion_settings (
  senior_id uuid primary key references profiles(id) on delete cascade,
  companion_name text not null default 'SilverBeam',
  senior_nickname text,
  voice_id text,
  updated_at timestamptz not null default now()
);

alter table companion_settings enable row level security;

create policy "companion_settings_select_senior" on companion_settings
  for select using (senior_id = auth.uid());

-- "for all" covers the upsert family Settings uses to create-or-update the
-- row on first save — there's no separate provisioning step when a senior
-- account is created.
create policy "companion_settings_all_linked_family" on companion_settings
  for all using (is_linked_family_member(senior_id))
  with check (is_linked_family_member(senior_id));

-- ---------------------------------------------------------------------
-- Let linked family set the senior's own photo (column-restricted, same
-- pattern as the relationship self-edit grant in 0004).
-- ---------------------------------------------------------------------
grant update (avatar_url) on profiles to authenticated;

create policy "profiles_update_linked_senior_avatar" on profiles
  for update using (role = 'senior' and is_linked_family_member(id))
  with check (role = 'senior' and is_linked_family_member(id));

-- Storage write access for that same case: family uploading to the
-- senior's uid-prefixed folder, not just their own (0004 only allowed
-- self-uploads).
create policy "avatars_write_linked_senior" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and exists (
      select 1 from senior_family_links
      where senior_id = (storage.foldername(name))[1]::uuid
        and family_member_id = auth.uid()
    )
  );

create policy "avatars_update_linked_senior" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and exists (
      select 1 from senior_family_links
      where senior_id = (storage.foldername(name))[1]::uuid
        and family_member_id = auth.uid()
    )
  );
