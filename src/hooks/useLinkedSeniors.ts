import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/state/useSession";

export interface LinkedSenior {
  linkId: string;
  seniorId: string;
  fullName: string;
  avatarUrl: string | null;
  isEmergencyContact: boolean;
  relationship: string | null;
}

// A family member may eventually be linked to more than one senior; the MVP
// dashboard uses the first result (most families in the beta cover one
// parent, and during testing the "first" link is often a stale re-setup),
// with the full list available for a future senior-picker. Ordered newest
// link first so primarySenior always tracks whichever senior device was
// most recently set up.
export function useLinkedSeniors() {
  const profile = useSession((s) => s.profile);
  const [seniors, setSeniors] = useState<LinkedSenior[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const familyMemberId = profile.id;

    const { data: links } = await supabase
      .from("senior_family_links")
      .select("id, senior_id, is_emergency_contact, relationship")
      .eq("family_member_id", familyMemberId)
      .order("created_at", { ascending: false });

    if (!links?.length) {
      setSeniors([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in(
        "id",
        links.map((l) => l.senior_id)
      );

    const merged = links.map((l) => ({
      linkId: l.id,
      seniorId: l.senior_id,
      fullName: profiles?.find((p) => p.id === l.senior_id)?.full_name ?? "Your family member",
      avatarUrl: profiles?.find((p) => p.id === l.senior_id)?.avatar_url ?? null,
      isEmergencyContact: l.is_emergency_contact,
      relationship: l.relationship,
    }));
    setSeniors(merged);
    setLoading(false);
  }, [profile?.id]);

  // A senior's id can change entirely from underneath a family member's
  // already-open app -- claim-senior-device (the "reconnect this device"
  // flow) migrates a senior's data to a fresh id and deletes the old
  // profile, with no way for a family app that was open before that
  // happened to know. A plain mount-only fetch would keep every
  // call/photo/etc. action pointed at the now-deleted old id until the
  // app was fully restarted. Refetching on every tab focus (same pattern
  // Dashboard/History already use for their own data) catches this within
  // one tab switch instead.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return { seniors, primarySenior: seniors[0] ?? null, loading, reload: load };
}
