import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
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

  return <CallWebView roomUrl={roomUrl} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.cream },
  loadingText: { fontSize: 20, color: colors.navy },
  errorText: { fontSize: 20, textAlign: "center", color: colors.danger },
  backButton: { backgroundColor: colors.terracotta, borderRadius: 10, paddingVertical: 16, paddingHorizontal: 24 },
  backButtonText: { color: colors.white, fontSize: 18, fontWeight: "600" },
});
