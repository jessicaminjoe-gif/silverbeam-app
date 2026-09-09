import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBoardContent } from "@/hooks/useBoardContent";
import { speak } from "@/lib/speech";
import { colors } from "@/theme/colors";

export default function OnThisDayScreen() {
  const insets = useSafeAreaInsets();
  const { items, loading, error } = useBoardContent("onThisDay");
  const [speaking, setSpeaking] = useState(false);
  const fact = items[0] ?? null;

  async function handleReadAloud() {
    if (!fact) return;
    setSpeaking(true);
    await speak(fact);
    setSpeaking(false);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color={colors.navy} />
        </Pressable>
        <Text style={styles.headerTitle}>On This Day</Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.terracotta} />
        ) : error || !fact ? (
          <Text style={styles.emptyText}>No history fact to show right now. Please try again later.</Text>
        ) : (
          <>
            <Ionicons name="time" size={64} color={colors.terracotta} style={{ marginBottom: 16 }} />
            <Text style={styles.factText}>{fact}</Text>
            <Pressable
              style={styles.readAloudButton}
              onPress={handleReadAloud}
              disabled={speaking}
              accessibilityRole="button"
              accessibilityLabel="Read this fact aloud"
            >
              {speaking ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Ionicons name="volume-high" size={22} color={colors.white} />
              )}
              <Text style={styles.readAloudButtonText}>Read Aloud</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: colors.navy },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { fontSize: 18, textAlign: "center", color: colors.textMuted, lineHeight: 26 },
  factText: { fontSize: 20, lineHeight: 28, color: colors.text, textAlign: "center" },
  readAloudButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.terracotta,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 28,
  },
  readAloudButtonText: { color: colors.white, fontSize: 17, fontWeight: "700" },
});
