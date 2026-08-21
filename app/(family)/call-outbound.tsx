import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";
import { CallWebView } from "@/components/CallWebView";

interface CreateFamilyCallResponse {
  roomUrl: string;
}

// Family-initiated counterpart to the senior's call screen. Reached from
// the Dashboard's "Video Call" button, passing which senior to call.
export default function FamilyOutboundCallScreen() {
  const { seniorId } = useLocalSearchParams<{ seniorId: string }>();
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callEnded, setCallEnded] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function start() {
      const { data, error: fnError } = await supabase.functions.invoke<CreateFamilyCallResponse>(
        "create-family-call",
        { body: { seniorId } }
      );
      if (!mounted) return;
      if (fnError || !data?.roomUrl) {
        setError("Could not start the call. Please try again.");
        return;
      }
      setRoomUrl(data.roomUrl);
    }

    start();
    return () => {
      mounted = false;
    };
  }, [seniorId]);

  if (callEnded) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Call ended</Text>
        <Pressable style={styles.backButton} onPress={() => router.replace("/(family)/dashboard")} accessibilityRole="button">
          <Text style={styles.backButtonText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!roomUrl) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.terracotta} />
        <Text style={styles.loadingText}>Calling...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CallWebView roomUrl={roomUrl} onCallEnded={() => setCallEnded(true)} />
      {/* Daily's own Leave button should be enough on its own, but this is
          a guaranteed, app-controlled way out regardless of what's
          happening inside the WebView — the actual bug report here was
          that the call appeared to never hang up. */}
      <Pressable
        style={styles.endCallButton}
        onPress={() => setCallEnded(true)}
        accessibilityRole="button"
        accessibilityLabel="End call"
      >
        <Ionicons name="call" size={22} color={colors.white} style={{ transform: [{ rotate: "135deg" }] }} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.cream },
  loadingText: { fontSize: 20, color: colors.navy },
  errorText: { fontSize: 20, textAlign: "center", color: colors.danger },
  backButton: { backgroundColor: colors.terracotta, borderRadius: 10, paddingVertical: 16, paddingHorizontal: 24 },
  backButtonText: { color: colors.white, fontSize: 18, fontWeight: "600" },
  endCallButton: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    backgroundColor: colors.danger,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
