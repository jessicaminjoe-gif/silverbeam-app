-- Lets family bump up font size on the senior's screens for readability.
-- Defaults to 1.0 (no change) so existing seniors are unaffected until
-- family explicitly changes it, matching video_call_enabled's pattern.
alter table companion_settings add column text_scale numeric not null default 1.0;
