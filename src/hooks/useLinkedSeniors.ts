import { useCallback, useEffect, useState } from "react";
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
// parent), with the full list available for a future senior-picker.
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
      .eq("family_member_id", familyMemberId);

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

  useEffect(() => {
    load();
  }, [load]);

  return { seniors, primarySenior: seniors[0] ?? null, loading, reload: load };
}
