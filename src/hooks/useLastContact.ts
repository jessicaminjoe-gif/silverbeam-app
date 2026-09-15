import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface LastContact {
  at: string;
  relationship: string | null;
  fullName: string;
}

// "Did someone already reach out to Mom today?" -- the most recent of a
// video call, a shared photo, or a Love Note, across every linked family
// member, so multiple caregivers can coordinate without duplicating (or
// missing) effort. Whoever did it most recently wins, regardless of which
// of the three they did.
export function useLastContact(seniorId: string | undefined) {
  const [lastContact, setLastContact] = useState<LastContact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!seniorId) return;
    let mounted = true;

    async function load() {
      const [{ data: calls }, { data: photos }, { data: notes }] = await Promise.all([
        supabase
          .from("call_events")
          .select("target_family_member_id, started_at")
          .eq("senior_id", seniorId)
          .order("started_at", { ascending: false })
          .limit(1),
        supabase.from("shared_media").select("sender_id, created_at").eq("senior_id", seniorId).order("created_at", { ascending: false }).limit(1),
        supabase.from("family_notes").select("sender_id, created_at").eq("senior_id", seniorId).order("created_at", { ascending: false }).limit(1),
      ]);

      const candidates: { familyMemberId: string; at: string }[] = [];
      const call = calls?.[0];
      if (call?.target_family_member_id) candidates.push({ familyMemberId: call.target_family_member_id, at: call.started_at });
      const photo = photos?.[0];
      if (photo) candidates.push({ familyMemberId: photo.sender_id, at: photo.created_at });
      const note = notes?.[0];
      if (note) candidates.push({ familyMemberId: note.sender_id, at: note.created_at });

      if (!candidates.length) {
        if (mounted) {
          setLastContact(null);
          setLoading(false);
        }
        return;
      }

      const winner = candidates.reduce((latest, c) => (new Date(c.at) > new Date(latest.at) ? c : latest));

      const [{ data: link }, { data: profile }] = await Promise.all([
        supabase.from("senior_family_links").select("relationship").eq("senior_id", seniorId).eq("family_member_id", winner.familyMemberId).maybeSingle(),
        supabase.from("profiles").select("full_name").eq("id", winner.familyMemberId).maybeSingle(),
      ]);

      if (!mounted) return;
      setLastContact({ at: winner.at, relationship: link?.relationship ?? null, fullName: profile?.full_name ?? "Family" });
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [seniorId]);

  return { lastContact, loading };
}
