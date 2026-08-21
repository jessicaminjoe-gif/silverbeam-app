-- Family-to-senior photo sharing. One-directional (family -> senior) and
-- images-only for MVP -- matches the actual feedback ("drop in files such
-- as pictures") rather than building general file upload.

create table shared_media (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references profiles(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  caption text,
  viewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index on shared_media (senior_id, created_at desc);

alter table shared_media enable row level security;

create policy "shared_media_select_senior" on shared_media
  for select using (senior_id = auth.uid());

create policy "shared_media_select_linked_family" on shared_media
  for select using (is_linked_family_member(senior_id));

-- The senior marking photos as viewed (clearing the badge) is the only
-- client-side write senior-side; sending is handled by the share-photo
-- Edge Function via the service role, not a direct family insert, so the
-- accompanying push notification stays server-side like everywhere else.
create policy "shared_media_update_viewed_senior" on shared_media
  for update using (senior_id = auth.uid())
  with check (senior_id = auth.uid());

-- ---------------------------------------------------------------------
-- Private bucket -- deliberately NOT public like avatars. These are
-- personal family photos, not something that should be reachable by
-- anyone who guesses/finds the URL. Access goes through signed URLs,
-- gated by the same select policies as the table above.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('shared-media', 'shared-media', false)
on conflict (id) do nothing;

create policy "shared_media_storage_select_senior" on storage.objects
  for select using (
    bucket_id = 'shared-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "shared_media_storage_select_linked_family" on storage.objects
  for select using (
    bucket_id = 'shared-media'
    and exists (
      select 1 from senior_family_links
      where senior_id = (storage.foldername(name))[1]::uuid
        and family_member_id = auth.uid()
    )
  );

create policy "shared_media_storage_write_linked_family" on storage.objects
  for insert with check (
    bucket_id = 'shared-media'
    and exists (
      select 1 from senior_family_links
      where senior_id = (storage.foldername(name))[1]::uuid
        and family_member_id = auth.uid()
    )
  );
