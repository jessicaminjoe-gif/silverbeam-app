import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { BoardTiles, CompanionSettings } from "@/types/database";

const DEFAULT_CHECK_IN_OPTIONS = [
  { label: "Great", emoji: "😊" },
  { label: "Okay", emoji: "🙂" },
  { label: "Not great", emoji: "😕" },
  { label: "Rough day", emoji: "😣" },
];

// Board is capped at 6 tiles shown at once -- Headlines starts off so the
// default set is exactly 6; matches the DB column's default (0017).
export const DEFAULT_BOARD_TILES: BoardTiles = {
  call: true,
  photos: true,
  notes: true,
  checkin: true,
  weather: true,
  headlines: false,
  onThisDay: true,
};

export const MAX_BOARD_TILES = 6;

const DEFAULTS: Omit<CompanionSettings, "senior_id" | "updated_at"> = {
  companion_name: "SilverBeam",
  senior_nickname: null,
  voice_id: null,
  check_in_options: DEFAULT_CHECK_IN_OPTIONS,
  location_zip: null,
  briefing_weather: true,
  briefing_news: false,
  briefing_reminders: true,
  video_call_enabled: true,
  board_tiles: DEFAULT_BOARD_TILES,
  text_scale: 1.0,
};

// Used by both the senior (reading their own settings) and family (reading
// + editing a linked senior's settings). No row exists until family saves
// one for the first time — callers should treat a null settings value as
// "use the defaults," not as an error.
export function useCompanionSettings(seniorId: string | undefined) {
  const [settings, setSettings] = useState<CompanionSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!seniorId) return;
    const { data } = await supabase.from("companion_settings").select("*").eq("senior_id", seniorId).maybeSingle();
    setSettings(data as CompanionSettings | null);
    setLoading(false);
  }, [seniorId]);

  useEffect(() => {
    load();
  }, [load]);

  return { settings: settings ?? { senior_id: seniorId ?? "", updated_at: "", ...DEFAULTS }, loading, reload: load };
}
