import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/state/useSession";
import { useRegisterPushToken } from "@/hooks/useRegisterPushToken";
import { colors } from "@/theme/colors";
import type { Profile } from "@/types/database";

// The native splash screen (app.config.ts's `splash`) auto-hides as soon as
// the JS bundle is ready, which on a fast device can be well under a
// second — reads as a flash, not a real branded moment. Holding it open
// here and replacing it with an identical-looking in-JS screen (below)
// that stays up for a guaranteed minimum lets us add the tagline text a
// static native splash image can't carry, and control exactly how long it
// shows regardless of load speed.
SplashScreen.preventAutoHideAsync().catch(() => {});

const MIN_SPLASH_MS = 3000;

// expo export --platform web doesn't resolve local require()'d image
// sources correctly in the static bundle — see (auth)/login.tsx for the
// same workaround.
const logoSource = Platform.OS === "web" ? { uri: "/brand-icon.png" } : require("../assets/icon.png");

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
  const [splashElapsed, setSplashElapsed] = useState(false);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(() => setSplashElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  // The branded splash is a nice-to-have on a normal launch, but it must
  // never sit on top of and hide something the user opened the app *for* —
  // a cold start from tapping a notification can finish loading and
  // correctly navigate to e.g. the incoming-call screen well within the
  // 3s hold, leaving that screen fully rendered but invisible underneath
  // an opaque splash for the remainder. Dismiss immediately the moment we
  // know a notification launched the app, whether that's captured before
  // or after the timer would have elapsed on its own.
  useEffect(() => {
    if (pendingNotification) setSplashElapsed(true);
  }, [pendingNotification]);

  // Auto-navigates straight to the incoming-call screen the instant a
  // family member starts a call, via Realtime -- doesn't depend on the
  // senior noticing/tapping a push notification at all, which is both more
  // reliable and matches "would prefer a pop up... easier for the senior
  // to answer it." Only covers the app-already-open case (Realtime needs
  // an active connection); a fully closed app still relies on the push.
  useEffect(() => {
    if (!profile || profile.role !== "senior") return;
    const channel = supabase
      .channel(`incoming-calls:${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_events", filter: `senior_id=eq.${profile.id}` },
        (payload) => {
          const row = payload.new as { initiated_by: string; target_room_url: string | null; caller_label: string | null };
          if (row.initiated_by !== "family" || !row.target_room_url) return;
          setSplashElapsed(true);
          router.push({
            pathname: "/(senior)/incoming-call",
            params: { roomUrl: row.target_room_url, callerLabel: row.caller_label ?? "" },
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

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

  // Slot's mount timing relative to `loading` is deliberately unchanged
  // from before this splash feature existed (Slot doesn't exist at all
  // until loading is false) — that's the timing every other early-navigate
  // fix in this file (see the notification-handling effects above) was
  // already built and tested against. Rendering Slot unconditionally from
  // the very first pass instead — so the splash could sit on top of it as
  // a simple overlay — triggered "Attempted to navigate before mounting
  // the Root Layout" on every load, so that approach was reverted. Once
  // loading is false, Slot mounts exactly as it always did; the splash's
  // extra hold (past loading, until MIN_SPLASH_MS) sits on top of it here
  // as a plain overlay instead, which is safe since Slot/Navigation is
  // already fully mounted and ready by that point.
  if (loading) {
    return (
      <View style={splashStyles.container}>
        <Image source={logoSource} style={splashStyles.logo} accessibilityLabel="SilverBeam" />
        <Text style={splashStyles.title}>
          <Text style={splashStyles.titleSilver}>Silver</Text>
          <Text style={splashStyles.titleBeam}>Beam</Text>
        </Text>
        <Text style={splashStyles.tagline}>Staying close, made simple.</Text>
        <ActivityIndicator style={splashStyles.spinner} size="small" color={colors.terracotta} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      {!splashElapsed && (
        <View style={[splashStyles.container, StyleSheet.absoluteFillObject]}>
          <Image source={logoSource} style={splashStyles.logo} accessibilityLabel="SilverBeam" />
          <Text style={splashStyles.title}>
            <Text style={splashStyles.titleSilver}>Silver</Text>
            <Text style={splashStyles.titleBeam}>Beam</Text>
          </Text>
          <Text style={splashStyles.tagline}>Staying close, made simple.</Text>
          <ActivityIndicator style={splashStyles.spinner} size="small" color={colors.terracotta} />
        </View>
      )}
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream },
  logo: { width: 96, height: 96, marginBottom: 12 },
  title: { fontSize: 34, fontWeight: "700" },
  titleSilver: { color: colors.navy },
  titleBeam: { color: colors.terracotta },
  tagline: { fontSize: 16, color: colors.textMuted, marginTop: 6 },
  spinner: { marginTop: 32 },
});
