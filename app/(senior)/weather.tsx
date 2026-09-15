import { useState } from "react";
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import Text from "@/components/ScaledText";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBoardContent } from "@/hooks/useBoardContent";
import { speak, stopSpeaking } from "@/lib/speech";
import { colors } from "@/theme/colors";

// A Beam Board glance tile: real fetched data, not a companion reply --
// see board-content/index.ts. "Read aloud" is optional, not automatic,
// since the senior tapped in specifically to look at this, not to be
// spoken at.
function iconForCondition(condition: string): keyof typeof Ionicons.glyphMap {
  const c = condition.toLowerCase();
  if (c.includes("thunder")) return "thunderstorm";
  if (c.includes("snow")) return "snow";
  if (c.includes("rain") || c.includes("shower") || c.includes("drizzle")) return "rainy";
  if (c.includes("fog") || c.includes("haze") || c.includes("mist")) return "cloud";
  if (c.includes("cloud")) return c.includes("sun") || c.includes("partly") ? "partly-sunny" : "cloud";
  if (c.includes("wind")) return "flag";
  return "sunny";
}

export default function WeatherScreen() {
  const insets = useSafeAreaInsets();
  const { weather, records, loading, error } = useBoardContent("weather");
  const [speaking, setSpeaking] = useState(false);

  async function handleReadAloud() {
    if (speaking) {
      await stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (!weather?.description) return;
    setSpeaking(true);
    const result = await speak(weather.description, undefined, () => setSpeaking(false));
    if (!result.ok) setSpeaking(false);
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
            <View style={styles.hiLoRow}>
              {weather.high !== null && (
                <View style={styles.hiLoBlock}>
                  <Text style={styles.hiLoLabel}>High</Text>
                  <Text style={styles.hiLoValue}>{weather.high}°</Text>
                </View>
              )}
              {weather.low !== null && (
                <View style={styles.hiLoBlock}>
                  <Text style={styles.hiLoLabel}>Low</Text>
                  <Text style={styles.hiLoValue}>{weather.low}°</Text>
                </View>
              )}
            </View>

            <Ionicons name={iconForCondition(weather.condition)} size={72} color={colors.terracotta} />
            <Text style={styles.conditionText}>{weather.condition}</Text>

            <Pressable
              style={[styles.readAloudButton, speaking && styles.stopButton]}
              onPress={handleReadAloud}
              accessibilityRole="button"
              accessibilityLabel={speaking ? "Stop reading" : "Read weather aloud"}
            >
              <Ionicons name={speaking ? "stop" : "volume-high"} size={22} color={colors.white} />
              <Text style={styles.readAloudButtonText}>{speaking ? "Stop" : "Read Aloud"}</Text>
            </Pressable>

            {records && (records.high || records.low) && (
              <View style={styles.recordsCard}>
                <Text style={styles.recordsTitle}>For reference</Text>
                {records.high && (
                  <Text style={styles.recordsText}>
                    Warmest on this date since {records.high.year}: {records.high.temp}° ({records.high.year})
                  </Text>
                )}
                {records.low && (
                  <Text style={styles.recordsText}>
                    Coolest on this date since {records.low.year}: {records.low.temp}° ({records.low.year})
                  </Text>
                )}
              </View>
            )}
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
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 6 },
  emptyText: { fontSize: 18, textAlign: "center", color: colors.textMuted, lineHeight: 26 },
  conditionText: { fontSize: 22, fontWeight: "700", color: colors.navy, marginTop: 4, marginBottom: 16, textAlign: "center" },
  hiLoRow: { flexDirection: "row", gap: 40, marginBottom: 12 },
  hiLoBlock: { alignItems: "center" },
  hiLoLabel: { fontSize: 18, fontWeight: "700", color: colors.textMuted },
  hiLoValue: { fontSize: 80, fontWeight: "800", color: colors.navy, lineHeight: 88 },
  readAloudButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.terracotta,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  stopButton: { backgroundColor: colors.danger },
  readAloudButtonText: { color: colors.white, fontSize: 17, fontWeight: "700" },
  recordsCard: {
    marginTop: 28,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    width: "100%",
  },
  recordsTitle: { fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  recordsText: { fontSize: 15, color: colors.text },
});
