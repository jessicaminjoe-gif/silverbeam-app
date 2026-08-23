-- Lets the senior's app auto-navigate straight to the incoming-call screen
-- the moment a family member starts a call, via Realtime, instead of
-- relying entirely on the push notification being tapped -- addresses
-- "would prefer a pop up... so it's easier for the senior to answer it."
-- Works whenever the app is already open; a closed app still relies on the
-- push notification, since Realtime needs an active connection.
alter table call_events add column initiated_by text not null default 'senior' check (initiated_by in ('senior', 'family'));

-- Only populated by create-family-call: the senior-scoped, name-prefilled
-- meeting URL and the caller's relationship label, precomputed server-side
-- so the realtime handler can navigate directly without a second round trip.
alter table call_events add column target_room_url text;
alter table call_events add column caller_label text;

alter publication supabase_realtime add table call_events;
