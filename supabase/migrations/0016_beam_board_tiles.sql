-- Family-side control over which tiles appear on the senior's Beam Board
-- (the tile-grid home screen). A single jsonb column, same pattern as
-- check_in_options (0008), rather than one boolean column per tile -- new
-- tiles can be added later without another migration. Defaults to
-- everything on so existing seniors see no change until family adjusts it.
-- "Ask {companion}" isn't in here -- it's a fixed secondary button, not a
-- toggleable board tile.
alter table companion_settings
  add column board_tiles jsonb not null default '{
    "call": true,
    "photos": true,
    "notes": true,
    "checkin": true,
    "weather": true,
    "headlines": true,
    "onThisDay": true
  }'::jsonb;
