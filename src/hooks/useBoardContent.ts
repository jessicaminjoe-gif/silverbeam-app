import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type BoardContentTile = "weather" | "headlines" | "onThisDay";

// Backs the Beam Board's glance tiles (Weather, Headlines, On This Day) --
// all three call the same board-content Edge Function, just with a
// different `tile` key, so this one hook covers all three screens.
export function useBoardContent(tile: BoardContentTile) {
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const { data, error: fnError } = await supabase.functions.invoke<{ items: string[] }>("board-content", {
      body: { tile },
    });
    if (fnError) {
      setError(true);
      setItems([]);
    } else {
      setItems(data?.items ?? []);
    }
    setLoading(false);
  }, [tile]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, reload: load };
}
