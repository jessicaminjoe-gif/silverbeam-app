-- Family-configurable check-in options (up to 5, family decides the
-- wording/emoji) replacing the previously-hardcoded 4-option mood list.
-- Stored per-senior on companion_settings, which already holds the other
-- family-managed "how this senior's experience is set up" fields.
alter table companion_settings
  add column check_in_options jsonb not null default '[
    {"label": "Great", "emoji": "😊"},
    {"label": "Okay", "emoji": "🙂"},
    {"label": "Not great", "emoji": "😕"},
    {"label": "Rough day", "emoji": "😣"}
  ]'::jsonb;

-- The old mood check constraint assumed a fixed 4-value enum, which custom
-- options break. mood is kept (existing rows still have it) but no longer
-- constrained; new check-ins store the option's emoji directly instead of
-- relying on the old MOOD_EMOJI lookup-by-fixed-value.
alter table check_ins drop constraint if exists check_ins_mood_check;
alter table check_ins add column mood_emoji text;
