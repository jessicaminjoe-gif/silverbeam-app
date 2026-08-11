import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";
import { CallWebView } from "@/components/CallWebView";

interface CreateCallResponse {
  roomUrl: string;
}

export default function CallScreen() {
  const { familyMemberId } = useLocalSearchParams<{ familyMemberId: string }>();
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callEnded, setCallEnded] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function start() {
      const { data, error: fnError } = await supabase.functions.invoke<CreateCallResponse>("create-call", {
        body: { familyMemberId },
      });
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
  }, [familyMemberId]);

  if (callEnded) {
    return (
      <View style={styles.center}>
        <Text style={styles.waveEmoji}>👋</Text>
        <Text style={styles.goodbyeTitle}>Goodbye</Text>
        <Text style={styles.goodbyeSubtitle}>Have a nice day</Text>
        <Pressable style={styles.backButton} onPress={() => router.replace("/(senior)/home")} accessibilityRole="button">
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
        <Text style={styles.loadingText}>Starting your call...</Text>
      </View>
    );
  }

  return <CallWebView roomUrl={roomUrl} onCallEnded={() => setCallEnded(true)} accessibleControls />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.cream },
  loadingText: { fontSize: 20, color: colors.navy },
  errorText: { fontSize: 20, textAlign: "center", color: colors.danger },
  waveEmoji: { fontSize: 88 },
  goodbyeTitle: { fontSize: 44, fontWeight: "700", color: colors.navy },
  goodbyeSubtitle: { fontSize: 22, color: colors.textMuted, marginTop: -8 },
  backButton: { backgroundColor: colors.terracotta, borderRadius: 10, paddingVertical: 16, paddingHorizontal: 32, marginTop: 16 },
  backButtonText: { color: colors.white, fontSize: 20, fontWeight: "600" },
});
