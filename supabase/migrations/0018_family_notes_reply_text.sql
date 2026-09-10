-- Lets the senior send back one of a few canned text replies alongside
-- (or instead of) an emoji reaction -- same row, same senior-update RLS
-- policy from 0013 already covers this column, no new policy needed.
-- Freeform text rather than a checked enum (unlike reaction) so the set of
-- canned phrases offered client-side can change later without a migration.
alter table family_notes add column reply_text text check (char_length(reply_text) <= 100);
