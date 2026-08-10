import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";

// Registers this device's Expo push token against the signed-in profile so
// the chat/create-call Edge Functions can notify it (escalation alerts,
// "is calling" pushes). Called once profile is known, for both roles.
export function useRegisterPushToken(profileId: string | undefined) {
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    async function register() {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let status = existing;
      if (status !== "granted") {
        const { status: requested } = await Notifications.requestPermissionsAsync();
        status = requested;
      }
      if (status !== "granted") return;

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      if (cancelled) return;

      await supabase.from("push_tokens").upsert(
        {
          profile_id: profileId,
          token: tokenResponse.data,
          platform: Platform.OS,
        },
        { onConflict: "profile_id,token" }
      );
    }

    register().catch((err) => {
      // Non-fatal: push notifications are a safety-net channel, not the
      // only escalation signal (family also sees escalation_events in-app).
      // Logged rather than fully swallowed — a silent catch here previously
      // hid a real, systemic failure (Android push requires FCM
      // credentials that were never configured) for the entire beta.
      console.warn("[useRegisterPushToken] registration failed:", err);
    });

    return () => {
      cancelled = true;
    };
  }, [profileId]);
}
