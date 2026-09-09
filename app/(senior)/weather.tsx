import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBoardContent } from "@/hooks/useBoardContent";
import { speak } from "@/lib/speech";
import { colors } from "@/theme/colors";

// A Beam Board glance tile: real fetched data, not a companion reply --
// see board-content/index.ts. "Read aloud" is optional, not automatic,
// since the senior tapped in specifically to look at this, not to be
// spoken at.
export default function WeatherScreen() {
  const insets = useSafeAreaInsets();
  const { items, loading, error } = useBoardContent("weather");
  const [speaking, setSpeaking] = useState(false);
  const weather = items[0] ?? null;

  async function handleReadAloud() {
    if (!weather) return;
    setSpeaking(true);
    await speak(weather);
    setSpeaking(false);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color={colors.navy} />
        </Pressable>
        <Text style={styles.headerTitle}>Weather</Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.terracotta} />
        ) : error || !weather ? (
          <Text style={styles.emptyText}>
            No weather to show right now. Ask your family to add your ZIP code in Settings.
          </Text>
        ) : (
          <>
            <Ionicons name="partly-sunny" size={64} color={colors.terracotta} style={{ marginBottom: 16 }} />
            <Text style={styles.weatherText}>{weather}</Text>
            <Pressable
              style={styles.readAloudButton}
              onPress={handleReadAloud}
              disabled={speaking}
              accessibilityRole="button"
              accessibilityLabel="Read weather aloud"
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
  weatherText: { fontSize: 22, lineHeight: 30, color: colors.text, textAlign: "center" },
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
