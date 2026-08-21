import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/state/useSession";
import { useRegisterPushToken } from "@/hooks/useRegisterPushToken";
import { colors } from "@/theme/colors";
import type { Profile } from "@/types/database";

// Without an explicit handler, expo-notifications doesn't show anything
// while the app is in the foreground — pushes only appeared if the app was
// backgrounded/closed. This makes them show (with sound) regardless of
// whether the app is open, same as any other notification.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Dedicated high-importance channel for "is calling" pushes (create-call
// targets this by name) — max importance + a distinct vibration pattern so
// an incoming call reads as more urgent than a routine notification. Not a
// true looping ringtone (that needs a foreground service / full-screen
// intent, a bigger native feature) but a real step up from the default
// channel's single quiet buzz.
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("calls", {
    name: "Incoming calls",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    sound: "default",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthGate />
    </SafeAreaProvider>
  );
}

function AuthGate() {
  const { profile, loading, setProfile, setLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();
  useRegisterPushToken(profile?.id);
  const [pendingNotification, setPendingNotification] = useState<Record<string, unknown> | null>(null);

  // Handles both a tap while the app is backgrounded/foregrounded and a
  // cold start from a tap (the app wasn't running at all when the
  // notification came in). Native only — expo-notifications' response APIs
  // aren't implemented on web at all and throw synchronously there, which
  // crashed the whole app.
  //
  // This only captures the data — it deliberately does NOT navigate here.
  // On a cold start this effect fires before <Slot/> ever mounts (the render
  // below shows a plain spinner until `loading` is false), so a router.push
  // this early has no navigator to act on and gets silently lost. The actual
  // navigation happens in the effect below, once loading has settled.
  useEffect(() => {
    if (Platform.OS === "web") return;

    function captureNotification(data: Record<string, unknown> | undefined) {
      if (data && (typeof data.roomUrl === "string" || data.kind)) setPendingNotification(data);
    }

    Notifications.getLastNotificationResponseAsync().then((response) => {
      captureNotification(response?.notification.request.content.data);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      captureNotification(response.notification.request.content.data);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadProfile(userId: string) {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (mounted) setProfile((data as Profile) ?? null);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // Deliberately not toggling `loading` here (only the initial
        // getSession() check above does). Setting it true on every auth
        // event swaps the render below from <Slot/> to the spinner and
        // back, which unmounts and remounts whatever screen is currently
        // showing — silently discarding its local state. That broke the
        // senior device setup screen: it sets its own profile via
        // signInAnonymously(), which fired this same event, wiping the
        // screen's local "here's the id" state before it could render.
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    // The setup screen creates its own (anonymous) senior profile as part
    // of the flow, which this same effect would otherwise notice and
    // redirect away from immediately — before the family member running
    // setup ever sees the confirmation id. That screen navigates on its
    // own once they tap "Done".
    const onSetupSeniorDevice = segments.join("/") === "(auth)/setup-senior-device";
    if (onSetupSeniorDevice) return;

    if (!profile && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (profile?.role === "senior" && segments[0] !== "(senior)") {
      router.replace("/(senior)/home");
    } else if (profile?.role === "family" && segments[0] !== "(family)") {
      router.replace("/(family)/dashboard");
    }
  }, [profile, loading, segments]);

  // Runs after the redirect effect above in the same commit, so on the
  // render where loading first flips to false, this navigation lands after
  // (and overrides) that effect's default route(family)/dashboard replace —
  // otherwise a cold-start notification tap would land on Dashboard/Home
  // instead of the call/photo it was meant to open.
  useEffect(() => {
    if (loading || !pendingNotification || !profile) return;
    const { roomUrl, callerLabel, kind } = pendingNotification as {
      roomUrl?: string;
      callerLabel?: string;
      kind?: string;
    };

    if (profile.role === "family" && typeof roomUrl === "string") {
      router.push({ pathname: "/(family)/call", params: { roomUrl } });
    } else if (profile.role === "senior" && kind === "incoming_call" && typeof roomUrl === "string") {
      router.push({ pathname: "/(senior)/incoming-call", params: { roomUrl, callerLabel: callerLabel ?? "" } });
    } else if (profile.role === "senior" && kind === "photo") {
      router.push("/(senior)/photos");
    } else {
      return; // Not a shape we recognize for this role — leave it pending.
    }
    setPendingNotification(null);
  }, [loading, pendingNotification, profile]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}>
        <ActivityIndicator size="large" color={colors.terracotta} />
      </View>
    );
  }

  return <Slot />;
}
