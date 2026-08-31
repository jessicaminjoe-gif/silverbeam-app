-- Lets the senior react to a family note with one of five fixed emoji
-- reactions, so responding takes one tap instead of typing (senior-side
-- reads/writes are already covered by family_notes_update_viewed_senior's
-- row-level policy from 0013, which doesn't restrict which columns can
-- change on the senior's own row).
alter table family_notes
  add column reaction text check (reaction is null or reaction in ('heart', 'thumbs_up', 'smile', 'laugh', 'sad'));
