-- Lets an existing family member invite another (e.g. a granddaughter) to
-- connect to the same senior, without the founder manually inserting a
-- senior_family_links row for every new family signup. A short code
-- rather than a true clickable universal/app link -- this app isn't in an
-- app store yet (EAS internal builds only), so there's no hosted
-- association file a real tap-to-open link could resolve through. The
-- code is what gets shared (via the native share sheet, text, email,
-- whatever); the family app's "I have a code" screen does the rest.
create table family_invites (
  id uuid primary key default gen_random_uuid(),
  senior_id uuid not null references profiles(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,
  code text not null unique,
  relationship text,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index on family_invites (senior_id, created_at desc);

alter table family_invites enable row level security;

-- Read-only for clients (so family can see "invite sent, not used yet" in
-- Settings) -- creating and redeeming both go through service-role Edge
-- Functions (create-invite, redeem-invite) so a code's validity can be
-- checked and consumed atomically, and so redeeming one doesn't require
-- giving the redeemer (who isn't linked yet) any RLS access of their own.
create policy "family_invites_select_linked_family" on family_invites
  for select using (is_linked_family_member(senior_id));
