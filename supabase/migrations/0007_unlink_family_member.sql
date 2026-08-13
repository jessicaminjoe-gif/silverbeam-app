-- Lets a family member remove their own link to a senior (e.g. cleaning up
-- a stale test/re-setup link, or a real family member no longer wanting
-- updates). Deliberately scoped to their own link row only -- they can't
-- remove someone else's connection to the same senior.
create policy "links_delete_own" on senior_family_links
  for delete using (family_member_id = auth.uid());
