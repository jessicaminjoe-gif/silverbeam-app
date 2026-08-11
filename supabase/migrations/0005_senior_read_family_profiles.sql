-- The call-bubble picker needs the senior to read their linked family
-- members' name/photo. profiles RLS only had the reverse (family reading
-- their linked senior) — this was a gap, not by design.
create policy "profiles_select_linked_family_for_senior" on profiles
  for select using (
    role = 'family'
    and exists (
      select 1 from senior_family_links
      where senior_id = auth.uid() and family_member_id = profiles.id
    )
  );
