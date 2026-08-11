import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/state/useSession";

export interface CallContact {
  familyMemberId: string;
  fullName: string;
  avatarUrl: string | null;
  relationship: string | null;
  isEmergencyContact: boolean;
}

// Up to 4 bubbles on the senior's call picker — emergency contacts first,
// then in the order they were linked. More than 4 linked family members
// can exist; only the top 4 get a bubble.
export function useCallContacts() {
  const profile = useSession((s) => s.profile);
  const [contacts, setContacts] = useState<CallContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let mounted = true;

    async function load() {
      const { data: links } = await supabase
        .from("senior_family_links")
        .select("family_member_id, is_emergency_contact, relationship")
        .eq("senior_id", profile!.id)
        .order("is_emergency_contact", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(4);

      if (!links?.length) {
        if (mounted) {
          setContacts([]);
          setLoading(false);
        }
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in(
          "id",
          links.map((l) => l.family_member_id)
        );

      if (!mounted) return;
      const merged = links.map((l) => ({
        familyMemberId: l.family_member_id,
        fullName: profiles?.find((p) => p.id === l.family_member_id)?.full_name ?? "Family",
        avatarUrl: profiles?.find((p) => p.id === l.family_member_id)?.avatar_url ?? null,
        relationship: l.relationship,
        isEmergencyContact: l.is_emergency_contact,
      }));
      setContacts(merged);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [profile?.id]);

  return { contacts, loading };
}
