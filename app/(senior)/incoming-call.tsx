import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { speak, type SpeakResult } from "@/lib/speech";
import { colors } from "@/theme/colors";
import { CallWebView } from "@/components/CallWebView";

const MAX_ANNOUNCEMENT_WAIT_MS = 1500;

// A family-initiated call is unexpected from the senior's side (unlike
// calling out themselves), so this asks before video goes live — a moment
// to be ready, and a clear way to say "not now" without it feeling rude or
// confusing about whether the call is even happening.
export default function IncomingCallScreen() {
  const { roomUrl, callerLabel } = useLocalSearchParams<{ roomUrl: string; callerLabel?: string }>();
  const [answered, setAnswered] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const announced = useRef(false);
  const announcementPromise = useRef<Promise<SpeakResult> | null>(null);
  const label = callerLabel || "Someone";

  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    announcementPromise.current = speak(`${label} is calling...`);
  }, [label]);

  // The "who's calling" announcement is TTS over the network — it takes a
  // real moment to generate, and tapping Answer immediately (the natural
  // reaction to seeing "Incoming call") could otherwise connect the call
  // before that audio has even started, making it sound like it announces
  // *after* answering. Give it a brief, capped head start instead.
  async function handleAnswer() {
    setAnswering(true);
    await Promise.race([
      announcementPromise.current,
      new Promise((resolve) => setTimeout(resolve, MAX_ANNOUNCEMENT_WAIT_MS)),
    ]);
    setAnswered(true);
  }

  if (callEnded) {
    return (
      <View style={styles.center}>
        <Text style={styles.waveEmoji}>👋</Text>
        <Text style={styles.title}>Goodbye</Text>
        <Text style={styles.subtitle}>Have a nice day</Text>
        <Pressable style={styles.doneButton} onPress={() => router.replace("/(senior)/home")} accessibilityRole="button">
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  if (answered) {
    return <CallWebView roomUrl={roomUrl} onCallEnded={() => setCallEnded(true)} accessibleControls />;
  }

  return (
    <View style={styles.center}>
      <Ionicons name="call" size={64} color={colors.terracotta} />
      <Text style={styles.title}>Incoming call</Text>
      <Text style={styles.subtitle}>{label}</Text>

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.actionButton, styles.declineButton]}
          onPress={() => router.replace("/(senior)/home")}
          disabled={answering}
          accessibilityRole="button"
          accessibilityLabel="Not now"
        >
          <Ionicons name="close" size={32} color={colors.white} />
          <Text style={styles.actionButtonText}>Not now</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.answerButton]}
          onPress={handleAnswer}
          disabled={answering}
          accessibilityRole="button"
          accessibilityLabel={`Answer call from ${label}`}
        >
          {answering ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Ionicons name="videocam" size={32} color={colors.white} />
          )}
          <Text style={styles.actionButtonText}>Answer</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12, backgroundColor: colors.cream },
  title: { fontSize: 32, fontWeight: "700", color: colors.navy, marginTop: 8 },
  subtitle: { fontSize: 24, color: colors.textMuted, marginBottom: 24 },
  buttonRow: { flexDirection: "row", gap: 20, marginTop: 16 },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 32,
    gap: 8,
    minWidth: 130,
  },
  declineButton: { backgroundColor: colors.danger },
  answerButton: { backgroundColor: colors.sage },
  actionButtonText: { color: colors.white, fontSize: 18, fontWeight: "700" },
  waveEmoji: { fontSize: 88 },
  doneButton: { backgroundColor: colors.terracotta, borderRadius: 10, paddingVertical: 16, paddingHorizontal: 32, marginTop: 16 },
  doneButtonText: { color: colors.white, fontSize: 20, fontWeight: "600" },
});
