import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type BoardContentTile = "weather" | "headlines" | "onThisDay";

// Mirrors WeatherDetails / DateTempRecords in
// supabase/functions/chat/companion/briefing.ts -- only populated when
// tile === "weather".
export interface BoardWeather {
  condition: string;
  high: number | null;
  low: number | null;
  description: string;
}

export interface BoardTempRecord {
  temp: number;
  year: number;
}

export interface BoardWeatherRecords {
  high: BoardTempRecord | null;
  low: BoardTempRecord | null;
}

interface BoardContentResponse {
  items: string[];
  weather?: BoardWeather | null;
  records?: BoardWeatherRecords | null;
}

// Backs the Beam Board's glance tiles (Weather, Headlines, On This Day) --
// all three call the same board-content Edge Function, just with a
// different `tile` key, so this one hook covers all three screens.
export function useBoardContent(tile: BoardContentTile) {
  const [items, setItems] = useState<string[]>([]);
  const [weather, setWeather] = useState<BoardWeather | null>(null);
  const [records, setRecords] = useState<BoardWeatherRecords | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const { data, error: fnError } = await supabase.functions.invoke<BoardContentResponse>("board-content", {
      body: { tile },
    });
    if (fnError) {
      setError(true);
      setItems([]);
      setWeather(null);
      setRecords(null);
    } else {
      setItems(data?.items ?? []);
      setWeather(data?.weather ?? null);
      setRecords(data?.records ?? null);
    }
    setLoading(false);
  }, [tile]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, weather, records, loading, error, reload: load };
}
