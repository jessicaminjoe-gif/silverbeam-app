-- Lets a person's account be deleted (delete-account Edge Function).
--
-- A few columns point at profiles(id) without any delete rule, so deleting
-- a family member who was ever notified about an alert, acknowledged one,
-- was the target of a call, or redeemed an invite would fail with a
-- foreign-key error. The rows themselves are still useful history for the
-- senior's other family members, so just blank the reference instead of
-- deleting them.

alter table escalation_events
  drop constraint if exists escalation_events_notified_family_member_id_fkey,
  add constraint escalation_events_notified_family_member_id_fkey
    foreign key (notified_family_member_id) references profiles(id) on delete set null;

alter table escalation_events
  drop constraint if exists escalation_events_acknowledged_by_fkey,
  add constraint escalation_events_acknowledged_by_fkey
    foreign key (acknowledged_by) references profiles(id) on delete set null;

alter table call_events
  drop constraint if exists call_events_target_family_member_id_fkey,
  add constraint call_events_target_family_member_id_fkey
    foreign key (target_family_member_id) references profiles(id) on delete set null;

alter table family_invites
  drop constraint if exists family_invites_used_by_fkey,
  add constraint family_invites_used_by_fkey
    foreign key (used_by) references profiles(id) on delete set null;
