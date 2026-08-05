import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/state/useSession";
import type { Mood } from "@/types/database";

const MOODS: { value: Mood; label: string; emoji: string }[] = [
  { value: "great", label: "Great", emoji: "😊" },
  { value: "okay", label: "Okay", emoji: "🙂" },
  { value: "not_great", label: "Not great", emoji: "😕" },
  { value: "rough", label: "Rough day", emoji: "😣" },
];

// MVP note: summary is set to a simple mood label at check-in time.
// Generating a fuller AI summary from that day's conversation (via the
// `chat` function) is a straightforward Phase 2+ enhancement, not required
// for the beta's core loop.
export default function CheckInScreen() {
  const profile = useSession((s) => s.profile);
  const [submittingMood, setSubmittingMood] = useState<Mood | null>(null);

  async function handleSelect(mood: Mood, label: string) {
    if (!profile) return;
    setSubmittingMood(mood);
    await supabase.from("check_ins").insert({
      senior_id: profile.id,
      mood,
      summary: `Feeling: ${label}`,
      completed: true,
    });
    setSubmittingMood(null);
    router.replace("/(senior)/home");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>How are you feeling today?</Text>
      <View style={styles.grid}>
        {MOODS.map((m) => (
          <Pressable
            key={m.value}
            style={styles.moodButton}
            onPress={() => handleSelect(m.value, m.label)}
            disabled={submittingMood !== null}
            accessibilityRole="button"
            accessibilityLabel={m.label}
          >
            {submittingMood === m.value ? (
              <ActivityIndicator size="large" />
            ) : (
              <>
                <Text style={styles.emoji}>{m.emoji}</Text>
                <Text style={styles.moodLabel}>{m.label}</Text>
              </>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 24, justifyContent: "center" },
  prompt: { fontSize: 26, fontWeight: "700", textAlign: "center" },
  grid: { gap: 16 },
  moodButton: {
    minHeight: 90,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 16,
  },
  emoji: { fontSize: 40 },
  moodLabel: { fontSize: 22, fontWeight: "600" },
});
