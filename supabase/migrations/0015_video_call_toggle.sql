-- Lets family turn video calling off for a senior when necessary (e.g. a
-- rough stretch where calls aren't a good fit). Defaults to on so existing
-- seniors are unaffected until family explicitly changes it.
alter table companion_settings add column video_call_enabled boolean not null default true;
