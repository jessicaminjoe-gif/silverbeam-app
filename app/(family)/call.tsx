import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { colors } from "@/theme/colors";
import { CallWebView } from "@/components/CallWebView";
import { EndCallButton } from "@/components/EndCallButton";
import { broadcastCallEnded, useCallEndListener } from "@/lib/callSignal";

// Reached by tapping the "is calling" push notification (see the
// notification-response handler in app/_layout.tsx) or directly if the
// dashboard ever grows a "join call" affordance. roomUrl comes straight
// from the notification's data payload — this screen doesn't create a
// room itself, only the senior's "Call Family" button does that.
export default function FamilyCallScreen() {
  const { roomUrl, roomName } = useLocalSearchParams<{ roomUrl: string; roomName?: string }>();
  const [callEnded, setCallEnded] = useState(false);

  useCallEndListener(roomName, () => setCallEnded(true));

  function handleEndCall() {
    if (roomName) broadcastCallEnded(roomName);
    setCallEnded(true);
  }

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

  if (!roomUrl) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No call to join right now.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CallWebView roomUrl={roomUrl} onCallEnded={handleEndCall} />
      <EndCallButton onPress={handleEndCall} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.cream },
  loadingText: { fontSize: 20, color: colors.navy },
  errorText: { fontSize: 18, color: colors.textMuted, textAlign: "center" },
  backButton: { backgroundColor: colors.terracotta, borderRadius: 10, paddingVertical: 16, paddingHorizontal: 24 },
  backButtonText: { color: colors.white, fontSize: 18, fontWeight: "600" },
});
