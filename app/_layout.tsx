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
  const [pendingRoomUrl, setPendingRoomUrl] = useState<string | null>(null);

  // "Is calling" pushes carry { roomUrl } in their data payload (escalation
  // pushes carry no data at all, so this can't misfire on those). Handles
  // both a tap while the app is backgrounded/foregrounded and a cold start
  // from a tap (the app wasn't running at all when the notification came in).
  // Native only — expo-notifications' response APIs aren't implemented on
  // web at all and throw synchronously there, which crashed the whole app.
  //
  // This only captures the roomUrl — it deliberately does NOT navigate here.
  // On a cold start this effect fires before <Slot/> ever mounts (the render
  // below shows a plain spinner until `loading` is false), so a router.push
  // this early has no navigator to act on and gets silently lost. The actual
  // navigation happens in the effect below, once loading has settled.
  useEffect(() => {
    if (Platform.OS === "web") return;

    function captureRoomUrl(data: Record<string, unknown> | undefined) {
      const roomUrl = data?.roomUrl;
      if (typeof roomUrl === "string") setPendingRoomUrl(roomUrl);
    }

    Notifications.getLastNotificationResponseAsync().then((response) => {
      captureRoomUrl(response?.notification.request.content.data);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      captureRoomUrl(response.notification.request.content.data);
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
  // otherwise a cold-start notification tap would land on Dashboard instead
  // of the call it was meant to open.
  useEffect(() => {
    if (loading || !pendingRoomUrl || profile?.role !== "family") return;
    router.push({ pathname: "/(family)/call", params: { roomUrl: pendingRoomUrl } });
    setPendingRoomUrl(null);
  }, [loading, pendingRoomUrl, profile]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}>
        <ActivityIndicator size="large" color={colors.terracotta} />
      </View>
    );
  }

  return <Slot />;
}
