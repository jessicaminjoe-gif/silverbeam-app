import { useCallback, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { speak } from "@/lib/speech";

// Fires the greeting + weather/news/reminders once per calendar day, the
// first time the senior opens the app that day. Deliberately not built on
// useCompanionChat (which also loads/holds the full chat transcript) since
// this only needs to speak the result -- the reply is still persisted
// server-side, so it shows up in Chat's history too.
export function useDailyBriefing(seniorId: string | undefined, soundEnabled: boolean) {
  const firedToday = useRef(false);

  const trigger = useCallback(async () => {
    if (!seniorId) return;
    try {
      const { data, error } = await supabase.functions.invoke<{ message: string }>("chat", {
        body: { seniorId, briefing: true },
      });
      if (error || !data?.message) return;
      if (soundEnabled) speak(data.message);
    } catch {
      // Best-effort -- a missed daily greeting isn't worth surfacing an
      // error over.
    }
  }, [seniorId, soundEnabled]);

  useEffect(() => {
    if (!seniorId || firedToday.current) return;
    const key = `briefing-shown-${seniorId}-${new Date().toDateString()}`;
    let cancelled = false;
    AsyncStorage.getItem(key).then((shown) => {
      if (shown || cancelled) return;
      firedToday.current = true;
      trigger();
      AsyncStorage.setItem(key, "1");
    });
    return () => {
      cancelled = true;
    };
  }, [seniorId, trigger]);
}
