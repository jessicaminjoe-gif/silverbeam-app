import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBoardContent } from "@/hooks/useBoardContent";
import { speak } from "@/lib/speech";
import { colors } from "@/theme/colors";

export default function OnThisDayScreen() {
  const insets = useSafeAreaInsets();
  const { items: facts, loading, error } = useBoardContent("onThisDay");
  const [speaking, setSpeaking] = useState(false);
  const autoSpoken = useRef(false);

  async function readAloud() {
    if (!facts.length) return;
    setSpeaking(true);
    await speak(facts.length > 1 ? `On this day: ${facts.join(". Also on this day: ")}.` : facts[0]);
    setSpeaking(false);
  }

  // Reads the facts aloud automatically the moment they load -- unlike
  // Weather/Headlines, this tile defaults to speaking since it's the one
  // meant to be enjoyed hands-free, not just glanced at. The Read Aloud
  // button below is for playing it again, not the first play.
  useEffect(() => {
    if (loading || autoSpoken.current || !facts.length) return;
    autoSpoken.current = true;
    readAloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, facts]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color={colors.navy} />
        </Pressable>
        <Text style={styles.headerTitle}>On This Day</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.terracotta} />
      ) : error || !facts.length ? (
        <View style={styles.content}>
          <Text style={styles.emptyText}>No history facts to show right now. Please try again later.</Text>
        </View>
      ) : (
        <FlatList
          data={facts}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.factCard}>
              <Ionicons name="time" size={22} color={colors.terracotta} />
              <Text style={styles.factText}>{item}</Text>
            </View>
          )}
          ListFooterComponent={
            <Pressable
              style={styles.readAloudButton}
              onPress={readAloud}
              disabled={speaking}
              accessibilityRole="button"
              accessibilityLabel="Read these facts aloud again"
            >
              {speaking ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Ionicons name="volume-high" size={22} color={colors.white} />
              )}
              <Text style={styles.readAloudButtonText}>Read Aloud</Text>
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
  factCard: { flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: colors.white, borderRadius: 14, padding: 16 },
  factText: { flex: 1, fontSize: 18, lineHeight: 25, color: colors.text },
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
  readAloudButtonText: { color: colors.white, fontSize: 17, fontWeight: "700" },
});
