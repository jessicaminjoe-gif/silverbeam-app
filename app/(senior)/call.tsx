import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { speak } from "@/lib/speech";
import { colors } from "@/theme/colors";
import { CallWebView } from "@/components/CallWebView";
import { EndCallButton } from "@/components/EndCallButton";
import { broadcastCallEnded, useCallEndListener } from "@/lib/callSignal";

interface CreateCallResponse {
  roomUrl: string;
  roomName: string;
}

interface PresenceResponse {
  totalCount: number;
}

const NO_ANSWER_TIMEOUT_MS = 30_000;
const PRESENCE_POLL_INTERVAL_MS = 5_000;

export default function CallScreen() {
  const { familyMemberId, contactLabel } = useLocalSearchParams<{ familyMemberId: string; contactLabel?: string }>();
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callEnded, setCallEnded] = useState(false);
  const [noAnswer, setNoAnswer] = useState(false);
  const announced = useRef(false);

  useEffect(() => {
    if (!contactLabel || announced.current) return;
    announced.current = true;
    speak(`Calling ${contactLabel}...`);
  }, [contactLabel]);

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
      setRoomName(data.roomName);
    }

    start();
    return () => {
      mounted = false;
    };
  }, [familyMemberId]);

  // Polls whether anyone else has joined; auto-disconnects an unanswered
  // call after 30s instead of leaving the senior sitting on a silently
  // ringing screen indefinitely.
  useEffect(() => {
    if (!roomName) return;
    let mounted = true;
    const startedAt = Date.now();

    const interval = setInterval(async () => {
      if (!mounted) return;
      if (Date.now() - startedAt >= NO_ANSWER_TIMEOUT_MS) {
        clearInterval(interval);
        if (mounted) setNoAnswer(true);
        return;
      }
      const { data } = await supabase.functions.invoke<PresenceResponse>("check-call-presence", {
        body: { roomName },
      });
      if (mounted && (data?.totalCount ?? 0) >= 2) {
        clearInterval(interval);
      }
    }, PRESENCE_POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [roomName]);

  useCallEndListener(roomName, () => setCallEnded(true));

  function handleEndCall() {
    if (roomName) broadcastCallEnded(roomName);
    setCallEnded(true);
  }

  if (callEnded || noAnswer) {
    return (
      <View style={styles.center}>
        <Text style={styles.waveEmoji}>{noAnswer ? "😌" : "👋"}</Text>
        <Text style={styles.goodbyeTitle}>{noAnswer ? "No answer" : "Goodbye"}</Text>
        <Text style={styles.goodbyeSubtitle}>
          {noAnswer ? "They didn't pick up. Try again another time." : "Have a nice day"}
        </Text>
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
        <Text style={styles.loadingText}>{contactLabel ? `Calling ${contactLabel}...` : "Starting your call..."}</Text>
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
  errorText: { fontSize: 20, textAlign: "center", color: colors.danger },
  waveEmoji: { fontSize: 88 },
  goodbyeTitle: { fontSize: 44, fontWeight: "700", color: colors.navy },
  goodbyeSubtitle: { fontSize: 22, color: colors.textMuted, marginTop: -8, textAlign: "center" },
  backButton: { backgroundColor: colors.terracotta, borderRadius: 10, paddingVertical: 16, paddingHorizontal: 32, marginTop: 16 },
  backButtonText: { color: colors.white, fontSize: 20, fontWeight: "600" },
});
