-- Realtime isn't on by default per-table -- needed so the senior's home
-- screen can announce a new photo immediately while the app is open,
-- instead of only finding out via push notification or next screen visit.
alter publication supabase_realtime add table shared_media;
