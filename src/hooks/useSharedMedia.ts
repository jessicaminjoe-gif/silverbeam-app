import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { SharedMedia } from "@/types/database";

export interface SharedMediaItem extends SharedMedia {
  signedUrl: string | null;
}

const SIGNED_URL_EXPIRES_IN = 60 * 60; // 1 hour — plenty for a single viewing session

// Senior-side: the private "shared-media" bucket needs signed URLs (no
// public access, see migration 0009), so this fetches the rows and mints
// a signed URL per photo in one batched call rather than one request each.
export function useSharedMedia(seniorId: string | undefined) {
  const [items, setItems] = useState<SharedMediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!seniorId) return;
    const { data } = await supabase
      .from("shared_media")
      .select("*")
      .eq("senior_id", seniorId)
      .order("created_at", { ascending: false });

    const rows = (data as SharedMedia[]) ?? [];
    if (!rows.length) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data: signed } = await supabase.storage
      .from("shared-media")
      .createSignedUrls(
        rows.map((r) => r.storage_path),
        SIGNED_URL_EXPIRES_IN
      );

    setItems(
      rows.map((row, i) => ({ ...row, signedUrl: signed?.[i]?.signedUrl ?? null }))
    );
    setLoading(false);
  }, [seniorId]);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = items.filter((i) => !i.viewed_at).length;

  const markAllViewed = useCallback(async () => {
    if (!seniorId) return;
    const unviewedIds = items.filter((i) => !i.viewed_at).map((i) => i.id);
    if (!unviewedIds.length) return;
    await supabase.from("shared_media").update({ viewed_at: new Date().toISOString() }).in("id", unviewedIds);
    setItems((prev) => prev.map((i) => (unviewedIds.includes(i.id) ? { ...i, viewed_at: new Date().toISOString() } : i)));
  }, [seniorId, items]);

  return { items, unreadCount, loading, reload: load, markAllViewed };
}
