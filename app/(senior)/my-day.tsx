import { useCallback, useState } from "react";
import { View, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import Text from "@/components/ScaledText";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReminders } from "@/hooks/useReminders";
import { remindersForDay, upcomingReminders } from "@/lib/reminders";
import { speak, stopSpeaking } from "@/lib/speech";
import { useSession } from "@/state/useSession";
import { colors } from "@/theme/colors";

export default function MyDayScreen() {
  const insets = useSafeAreaInsets();
  const profile = useSession((s) => s.profile);
  const { reminders, loading, reload } = useReminders(profile?.id);
  const [speaking, setSpeaking] = useState(false);

  // Re-fetch (and so re-render with a fresh "today") every time the screen
  // is opened, so it's right after midnight too.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const now = new Date();
  const today = remindersForDay(reminders, now);
  const upcoming = upcomingReminders(reminders, now, 7);
  const todayLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  async function handleReadAloud() {
    if (speaking) {
      await stopSpeaking();
      setSpeaking(false);
      return;
    }
    const text = today.length
      ? `Today is ${todayLabel}. You have: ${today.map((r) => r.title).join(". Also: ")}.`
      : `Today is ${todayLabel}. Nothing on your list today.`;
    setSpeaking(true);
    const result = await speak(text, undefined, () => setSpeaking(false));
    if (!result.ok) setSpeaking(false);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color={colors.navy} />
        </Pressable>
        <Text style={styles.headerTitle}>My Day</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.terracotta} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.dateLabel}>{todayLabel}</Text>

          {today.length ? (
            today.map((r) => (
              <View key={r.id} style={styles.todayCard}>
                <Ionicons name="calendar" size={28} color={colors.sage} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.todayText}>{r.title}</Text>
                  {r.recurrence === "daily" && <Text style={styles.everyDay}>Every day</Text>}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.todayCard}>
              <Ionicons name="checkmark-circle" size={28} color={colors.sage} />
              <Text style={styles.todayText}>Nothing on your list today.</Text>
            </View>
          )}

          <Pressable
            style={[styles.readAloudButton, speaking && styles.stopButton]}
            onPress={handleReadAloud}
            accessibilityRole="button"
            accessibilityLabel={speaking ? "Stop reading" : "Read my day aloud"}
          >
            <Ionicons name={speaking ? "stop" : "volume-high"} size={24} color={colors.white} />
            <Text style={styles.readAloudButtonText}>{speaking ? "Stop" : "Read Aloud"}</Text>
          </Pressable>

          {upcoming.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Coming up this week</Text>
              {upcoming.map(({ reminder, when }) => (
                <View key={`${reminder.id}-${when}`} style={styles.upcomingRow}>
                  <Text style={styles.upcomingWhen}>{when}</Text>
                  <Text style={styles.upcomingText}>{reminder.title}</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "700", color: colors.navy },
  list: { padding: 16, gap: 14, paddingBottom: 32 },
  dateLabel: { fontSize: 20, fontWeight: "600", color: colors.textMuted },
  todayCard: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
  },
  todayText: { fontSize: 24, lineHeight: 32, fontWeight: "700", color: colors.navy },
  everyDay: { fontSize: 16, color: colors.textMuted, marginTop: 2 },
  readAloudButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.terracotta,
    borderRadius: 12,
    paddingVertical: 16,
  },
  stopButton: { backgroundColor: colors.danger },
  readAloudButtonText: { color: colors.white, fontSize: 20, fontWeight: "700" },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: colors.navy, marginTop: 12 },
  upcomingRow: { flexDirection: "row", gap: 12, alignItems: "baseline", paddingVertical: 4 },
  upcomingWhen: { fontSize: 17, fontWeight: "700", color: colors.terracotta, minWidth: 100 },
  upcomingText: { flex: 1, fontSize: 18, color: colors.text },
});
