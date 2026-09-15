import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/state/useSession";

export interface EmergencyContact {
  fullName: string;
  phone: string;
}

// Powers the one-tap "Call emergency contact" button on the Beam Board --
// a fixed, always-visible element (not a toggleable tile) so family can't
// accidentally hide emergency access via the 6-tile cap.
export function useEmergencyContact() {
  const profile = useSession((s) => s.profile);
  const [contact, setContact] = useState<EmergencyContact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let mounted = true;

    async function load() {
      const { data: link } = await supabase
        .from("senior_family_links")
        .select("family_member_id")
        .eq("senior_id", profile!.id)
        .eq("is_emergency_contact", true)
        .limit(1)
        .maybeSingle();

      if (!link) {
        if (mounted) {
          setContact(null);
          setLoading(false);
        }
        return;
      }

      const { data: emergencyProfile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", link.family_member_id)
        .maybeSingle();

      if (!mounted) return;
      setContact(emergencyProfile?.phone ? { fullName: emergencyProfile.full_name, phone: emergencyProfile.phone } : null);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [profile?.id]);

  return { contact, loading };
}
