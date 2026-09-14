import { useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBoardContent } from "@/hooks/useBoardContent";
import { speak, stopSpeaking } from "@/lib/speech";
import { colors } from "@/theme/colors";

export default function HeadlinesScreen() {
  const insets = useSafeAreaInsets();
  const { items: headlines, loading, error } = useBoardContent("headlines");
  const [speaking, setSpeaking] = useState(false);

  async function handleReadAloud() {
    if (speaking) {
      await stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (!headlines.length) return;
    setSpeaking(true);
    const result = await speak(`Today's top headlines: ${headlines.join(". Next: ")}.`, undefined, () => setSpeaking(false));
    if (!result.ok) setSpeaking(false);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color={colors.navy} />
        </Pressable>
        <Text style={styles.headerTitle}>Headlines</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.terracotta} />
      ) : error || !headlines.length ? (
        <View style={styles.content}>
          <Text style={styles.emptyText}>No headlines to show right now. Please try again later.</Text>
        </View>
      ) : (
        <FlatList
          data={headlines}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.headlineCard}>
              <Ionicons name="newspaper" size={22} color={colors.terracotta} />
              <Text style={styles.headlineText}>{item}</Text>
            </View>
          )}
          ListFooterComponent={
            <Pressable
              style={[styles.readAloudButton, speaking && styles.stopButton]}
              onPress={handleReadAloud}
              accessibilityRole="button"
              accessibilityLabel={speaking ? "Stop reading" : "Read headlines aloud"}
            >
              <Ionicons name={speaking ? "stop" : "volume-high"} size={22} color={colors.white} />
              <Text style={styles.readAloudButtonText}>{speaking ? "Stop" : "Read Aloud"}</Text>
            </Pressable>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: colors.navy },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { fontSize: 18, textAlign: "center", color: colors.textMuted, lineHeight: 26 },
  list: { padding: 16, gap: 12 },
  headlineCard: { flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: colors.white, borderRadius: 14, padding: 16 },
  headlineText: { flex: 1, fontSize: 18, lineHeight: 25, color: colors.text },
  readAloudButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.terracotta,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  stopButton: { backgroundColor: colors.danger },
  readAloudButtonText: { color: colors.white, fontSize: 17, fontWeight: "700" },
});
