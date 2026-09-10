-- Lets a family note carry a short voice recording instead of (or the
-- transcript ends up as) typed text. body stays the source of truth for
-- display/search/reactions -- send-note fills it in with the Whisper
-- transcript when a note arrives with audio instead of typed text, so
-- every existing render path (Love Notes, Updates) needs no branching.
alter table family_notes add column audio_path text;

-- Private bucket, same shape as shared-media (0009): the senior and their
-- linked family can read via signed URL, only linked family can write, and
-- objects are scoped by the senior's id being the top-level folder.
insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', false)
on conflict (id) do nothing;

create policy "voice_notes_storage_select_senior" on storage.objects
  for select using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "voice_notes_storage_select_linked_family" on storage.objects
  for select using (
    bucket_id = 'voice-notes'
    and exists (
      select 1 from senior_family_links
      where senior_id = (storage.foldername(name))[1]::uuid
        and family_member_id = auth.uid()
    )
  );

create policy "voice_notes_storage_write_linked_family" on storage.objects
  for insert with check (
    bucket_id = 'voice-notes'
    and exists (
      select 1 from senior_family_links
      where senior_id = (storage.foldername(name))[1]::uuid
        and family_member_id = auth.uid()
    )
  );
