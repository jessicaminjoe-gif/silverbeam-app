import { useEffect, useRef, useState } from "react";
import { View, Image, Pressable, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import Text from "@/components/ScaledText";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBoardContent, type BoardOnThisDayFact } from "@/hooks/useBoardContent";
import { speak, stopSpeaking } from "@/lib/speech";
import { colors } from "@/theme/colors";

export default function OnThisDayScreen() {
  const insets = useSafeAreaInsets();
  const { facts, loading, error } = useBoardContent("onThisDay");
  const [speaking, setSpeaking] = useState(false);
  const autoSpoken = useRef(false);

  async function readAloud() {
    if (speaking) {
      await stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (!facts.length) return;
    setSpeaking(true);
    const texts = facts.map((f) => f.text);
    const result = await speak(
      texts.length > 1 ? `On this day: ${texts.join(". Also on this day: ")}.` : texts[0],
      undefined,
      () => setSpeaking(false)
    );
    if (!result.ok) setSpeaking(false);
  }

  // Reads the facts aloud automatically the moment they load -- unlike
  // Weather/Headlines, this tile defaults to speaking since it's the one
  // meant to be enjoyed hands-free, not just glanced at. The Read Aloud
  // button below can stop it or play it again.
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
          renderItem={({ item }) => <FactCard fact={item} />}
          ListFooterComponent={
            <Pressable
              style={[styles.readAloudButton, speaking && styles.stopButton]}
              onPress={readAloud}
              accessibilityRole="button"
              accessibilityLabel={speaking ? "Stop reading" : "Read these facts aloud again"}
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

function FactCard({ fact }: { fact: BoardOnThisDayFact }) {
  return (
    <View style={styles.factCard}>
      <View style={styles.factHeader}>
        <Ionicons name="time" size={26} color={colors.terracotta} />
        <Text style={styles.factText}>{fact.text}</Text>
      </View>
      {fact.imageUrl && <Image source={{ uri: fact.imageUrl }} style={styles.factImage} resizeMode="cover" />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: colors.navy },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { fontSize: 18, textAlign: "center", color: colors.textMuted, lineHeight: 26 },
  list: { padding: 16, gap: 16, flexGrow: 1 },
  factCard: { gap: 14, backgroundColor: colors.white, borderRadius: 16, padding: 20 },
  factHeader: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  factText: { flex: 1, fontSize: 22, lineHeight: 30, color: colors.text },
  factImage: { width: "100%", aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: colors.sageLight },
  readAloudButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.terracotta,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
  },
  stopButton: { backgroundColor: colors.danger },
  readAloudButtonText: { color: colors.white, fontSize: 18, fontWeight: "700" },
});
