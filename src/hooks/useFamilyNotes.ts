import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FamilyNote } from "@/types/database";

// Senior-side: mirrors useSharedMedia.ts's shape (unreadCount, markAllViewed)
// minus the signed-URL step, since notes are plain text with no storage
// object behind them.
export function useFamilyNotes(seniorId: string | undefined) {
  const [notes, setNotes] = useState<FamilyNote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!seniorId) return;
    const { data } = await supabase
      .from("family_notes")
      .select("*")
      .eq("senior_id", seniorId)
      .order("created_at", { ascending: false });
    setNotes((data as FamilyNote[]) ?? []);
    setLoading(false);
  }, [seniorId]);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = notes.filter((n) => !n.viewed_at).length;

  const markAllViewed = useCallback(async () => {
    if (!seniorId) return;
    const unviewedIds = notes.filter((n) => !n.viewed_at).map((n) => n.id);
    if (!unviewedIds.length) return;
    await supabase.from("family_notes").update({ viewed_at: new Date().toISOString() }).in("id", unviewedIds);
    setNotes((prev) => prev.map((n) => (unviewedIds.includes(n.id) ? { ...n, viewed_at: new Date().toISOString() } : n)));
  }, [seniorId, notes]);

  return { notes, unreadCount, loading, reload: load, markAllViewed };
}
