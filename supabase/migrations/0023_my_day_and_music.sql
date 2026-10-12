-- "My Day" (today's reminders) and "My Music" (family-added links to the
-- senior's own music apps) Beam Board tiles.

-- Family-managed music links. The senior just taps a button that opens the
-- link in whatever app handles it (Spotify, Pandora, Apple Music, YouTube...)
-- -- no in-app playback. Same RLS shape as reminders (0012). Only web links
-- are storable, so nothing like javascript: can ever reach the senior's
-- device; the 4-link cap is enforced client-side, same precedent as the
-- 6-tile cap (0017).
create table music_links (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references profiles(id) on delete cascade,
  label text not null,
  url text not null check (url ~* '^https?://'),
  created_at timestamptz not null default now()
);

create index on music_links (senior_id);

alter table music_links enable row level security;

create policy "music_links_select_senior" on music_links
  for select using (senior_id = auth.uid());

create policy "music_links_all_linked_family" on music_links
  for all using (is_linked_family_member(senior_id))
  with check (is_linked_family_member(senior_id));

-- New default board: My Day replaces Check In, My Music replaces On This
-- Day. Check In, Headlines and On This Day stay available for family to
-- turn on (still max 6 at once).
alter table companion_settings
  alter column board_tiles set default '{
    "call": true,
    "photos": true,
    "notes": true,
    "checkin": false,
    "weather": true,
    "headlines": false,
    "onThisDay": false,
    "myDay": true,
    "music": true
  }'::jsonb;

-- Same rule 0017 used: only rows still sitting exactly at the previous
-- default move to the new one. Boards family already customized are left
-- untouched (they just don't get the new tiles until family turns them on).
update companion_settings
set board_tiles = '{
    "call": true,
    "photos": true,
    "notes": true,
    "checkin": false,
    "weather": true,
    "headlines": false,
    "onThisDay": false,
    "myDay": true,
    "music": true
  }'::jsonb
where board_tiles = '{
    "call": true,
    "photos": true,
    "notes": true,
    "checkin": true,
    "weather": true,
    "headlines": false,
    "onThisDay": true
  }'::jsonb;
