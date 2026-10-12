import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MusicLink } from "@/types/database";

export const MAX_MUSIC_LINKS = 4;

// Used by both the senior (reading their own links) and family (managing a
// linked senior's) -- RLS decides who can write.
export function useMusicLinks(seniorId: string | undefined) {
  const [links, setLinks] = useState<MusicLink[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!seniorId) return;
    const { data } = await supabase
      .from("music_links")
      .select("*")
      .eq("senior_id", seniorId)
      .order("created_at", { ascending: true });
    setLinks((data as MusicLink[] | null) ?? []);
    setLoading(false);
  }, [seniorId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addLink(input: { label: string; url: string }) {
    if (!seniorId) return { error: "No senior selected" };
    const { error } = await supabase.from("music_links").insert({ senior_id: seniorId, ...input });
    if (!error) await load();
    return { error: error?.message ?? null };
  }

  async function removeLink(id: string) {
    const { error } = await supabase.from("music_links").delete().eq("id", id);
    if (!error) setLinks((prev) => prev.filter((l) => l.id !== id));
    return { error: error?.message ?? null };
  }

  return { links, loading, reload: load, addLink, removeLink };
}
