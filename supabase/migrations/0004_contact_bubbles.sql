-- Multi-contact call bubbles: senior taps one of up to 4 linked family
-- members (photo + relationship tag) instead of one "Call Family" blast.
-- Reuses existing profiles.avatar_url and senior_family_links.relationship
-- columns — this migration just opens up self-service editing of both plus
-- storage for avatar uploads, and lets create-call target one contact.

-- ---------------------------------------------------------------------
-- Avatar photo storage. Public read (bubbles/avatars render for both
-- senior and family, no auth'd fetch plumbing needed), write restricted
-- to files under the caller's own uid-prefixed path.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_write_own" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- Let a family member set their own relationship tag on a link row
-- ("Son", "Neighbor", etc). Column-level grant means this policy can't be
-- used to smuggle in changes to senior_id/family_member_id/
-- is_emergency_contact — those stay founder-managed via the service role.
-- ---------------------------------------------------------------------
grant update (relationship) on senior_family_links to authenticated;

create policy "links_update_own_relationship" on senior_family_links
  for update using (family_member_id = auth.uid())
  with check (family_member_id = auth.uid());

-- ---------------------------------------------------------------------
-- Record which contact a call was placed to, so History can show
-- "Call to Son" instead of just "Video call", and so create-call can
-- notify only the tapped bubble instead of every linked family member.
-- ---------------------------------------------------------------------
alter table call_events add column target_family_member_id uuid references profiles(id);
