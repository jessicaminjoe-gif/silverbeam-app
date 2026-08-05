import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/state/useSession";

export interface LinkedSenior {
  seniorId: string;
  fullName: string;
  isEmergencyContact: boolean;
}

// A family member may eventually be linked to more than one senior; the MVP
// dashboard uses the first result (most families in the beta cover one
// parent), with the full list available for a future senior-picker.
export function useLinkedSeniors() {
  const profile = useSession((s) => s.profile);
  const [seniors, setSeniors] = useState<LinkedSenior[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const familyMemberId = profile.id;
    let mounted = true;

    async function load() {
      const { data: links } = await supabase
        .from("senior_family_links")
        .select("senior_id, is_emergency_contact")
        .eq("family_member_id", familyMemberId);

      if (!links?.length) {
        if (mounted) {
          setSeniors([]);
          setLoading(false);
        }
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in(
          "id",
          links.map((l) => l.senior_id)
        );

      if (!mounted) return;
      const merged = links.map((l) => ({
        seniorId: l.senior_id,
        fullName: profiles?.find((p) => p.id === l.senior_id)?.full_name ?? "Your family member",
        isEmergencyContact: l.is_emergency_contact,
      }));
      setSeniors(merged);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [profile?.id]);

  return { seniors, primarySenior: seniors[0] ?? null, loading };
}
