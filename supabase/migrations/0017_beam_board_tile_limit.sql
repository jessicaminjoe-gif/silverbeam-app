-- Board is capped at 6 tiles shown at once (family picks up to 6, not all
-- 7 freely) -- enforced client-side in SeniorContactSettings.tsx. Headlines
-- starts off by default so the out-of-the-box board is exactly 6; family
-- can turn Headlines on by turning another tile off first.
alter table companion_settings
  alter column board_tiles set default '{
    "call": true,
    "photos": true,
    "notes": true,
    "checkin": true,
    "weather": true,
    "headlines": false,
    "onThisDay": true
  }'::jsonb;

-- Existing rows still sitting at 0016's original all-seven-on default get
-- moved to the new default too. Rows family has already customized (any
-- other combination) are left untouched -- this only corrects the
-- untouched-default case.
update companion_settings
set board_tiles = board_tiles || '{"headlines": false}'::jsonb
where board_tiles = '{
    "call": true,
    "photos": true,
    "notes": true,
    "checkin": true,
    "weather": true,
    "headlines": true,
    "onThisDay": true
  }'::jsonb;
