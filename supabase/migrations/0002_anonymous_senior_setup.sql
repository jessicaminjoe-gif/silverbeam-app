-- Supports the "set up this device" flow: a family member sets up a
-- senior's device once, in person, via supabase.auth.signInAnonymously() —
-- no email or phone required from the senior at all. Anonymous auth users
-- get a real auth.uid() just like any other user, so this mirrors the
-- existing family self-insert policy, just for role='senior'.
create policy "profiles_insert_self_senior" on profiles
  for insert with check (id = auth.uid() and role = 'senior');
