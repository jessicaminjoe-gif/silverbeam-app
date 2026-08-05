import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useLinkedSeniors } from "@/hooks/useLinkedSeniors";
import type { CheckIn, EscalationEvent } from "@/types/database";

const MOOD_EMOJI: Record<string, string> = {
  great: "😊",
  okay: "🙂",
  not_great: "😕",
  rough: "😣",
};

export default function DashboardScreen() {
  const { primarySenior, loading: loadingSeniors } = useLinkedSeniors();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [activeEscalations, setActiveEscalations] = useState<EscalationEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!primarySenior) return;
    const [{ data: checkInData }, { data: escalationData }] = await Promise.all([
      supabase
        .from("check_ins")
        .select("*")
        .eq("senior_id", primarySenior.seniorId)
        .order("occurred_at", { ascending: false })
        .limit(30),
      supabase
        .from("escalation_events")
        .select("*")
        .eq("senior_id", primarySenior.seniorId)
        .eq("resolved", false)
        .order("created_at", { ascending: false }),
    ]);
    setCheckIns((checkInData as CheckIn[]) ?? []);
    setActiveEscalations((escalationData as EscalationEvent[]) ?? []);
    setLoading(false);
  }, [primarySenior?.seniorId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loadingSeniors || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!primarySenior) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>
          You're not linked to a SilverBeam senior account yet. Reach out to the SilverBeam team to get connected.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={checkIns}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <Text style={styles.heading}>{primarySenior.fullName}</Text>
          {activeEscalations.map((e) => (
            <Pressable
              key={e.id}
              style={[styles.alertBanner, e.severity === "high" ? styles.alertHigh : styles.alertMedium]}
              onPress={() => router.push({ pathname: "/(family)/escalation-detail", params: { id: e.id } })}
            >
              <Text style={styles.alertText}>
                {e.severity.toUpperCase()} alert — {e.trigger_reason ?? "possible concern"}. Tap for details.
              </Text>
            </Pressable>
          ))}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.checkInRow}>
          <Text style={styles.moodEmoji}>{item.mood ? MOOD_EMOJI[item.mood] : "•"}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.summary}>{item.summary ?? "Check-in recorded"}</Text>
            <Text style={styles.date}>{new Date(item.occurred_at).toLocaleString()}</Text>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>No check-ins yet.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  list: { padding: 16, gap: 10 },
  heading: { fontSize: 24, fontWeight: "700" },
  emptyText: { fontSize: 16, textAlign: "center", color: "#555" },
  checkInRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: "#f7f7f7",
    borderRadius: 12,
    padding: 14,
  },
  moodEmoji: { fontSize: 28 },
  summary: { fontSize: 16, fontWeight: "500" },
  date: { fontSize: 13, color: "#777", marginTop: 2 },
  alertBanner: { borderRadius: 12, padding: 14 },
  alertHigh: { backgroundColor: "#ffd6d6" },
  alertMedium: { backgroundColor: "#ffe8c2" },
  alertText: { fontSize: 15, fontWeight: "600" },
});
