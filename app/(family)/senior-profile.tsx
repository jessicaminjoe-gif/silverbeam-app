import { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { useLinkedSeniors } from "@/hooks/useLinkedSeniors";
import { colors } from "@/theme/colors";
import type { CallEvent, CheckIn, EscalationEvent } from "@/types/database";

const MOOD_LABEL: Record<string, string> = {
  great: "Great",
  okay: "Okay",
  not_great: "Not great",
  rough: "Rough",
};

type HistoryItem =
  | { kind: "alert"; id: string; at: string; data: EscalationEvent }
  | { kind: "check_in"; id: string; at: string; data: CheckIn }
  | { kind: "call"; id: string; at: string; data: CallEvent };

export default function SeniorProfileScreen() {
  const { primarySenior, loading: loadingSeniors } = useLinkedSeniors();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!primarySenior) return;
    const seniorId = primarySenior.seniorId;
    const [{ data: alerts }, { data: checkIns }, { data: calls }] = await Promise.all([
      supabase.from("escalation_events").select("*").eq("senior_id", seniorId),
      supabase.from("check_ins").select("*").eq("senior_id", seniorId),
      supabase.from("call_events").select("*").eq("senior_id", seniorId),
    ]);

    const merged: HistoryItem[] = [
      ...(alerts ?? []).map((a): HistoryItem => ({ kind: "alert", id: `alert-${a.id}`, at: a.created_at, data: a as EscalationEvent })),
      ...(checkIns ?? []).map((c): HistoryItem => ({ kind: "check_in", id: `checkin-${c.id}`, at: c.occurred_at, data: c as CheckIn })),
      ...(calls ?? []).map((c): HistoryItem => ({ kind: "call", id: `call-${c.id}`, at: c.started_at, data: c as CallEvent })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    setItems(merged);
    setLoading(false);
  }, [primarySenior?.seniorId]);

  // Tabs stay mounted when you switch away, so a plain mount-only fetch
  // would never pick up an escalation that fires while the app is already
  // open. Refetch every time this tab regains focus, not just on mount.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loadingSeniors || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.terracotta} />
      </View>
    );
  }

  if (!primarySenior) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No linked senior account yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.heading}>{primarySenior.fullName} — History</Text>}
      renderItem={({ item }) => {
        if (item.kind === "alert") {
          const a = item.data;
          return (
            <Pressable
              style={styles.row}
              onPress={() => router.push({ pathname: "/(family)/escalation-detail", params: { id: a.id } })}
            >
              <Text style={[styles.badge, styles.badgeAlert]}>ALERT</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{a.trigger_reason ?? "Possible concern"}</Text>
                <Text style={styles.date}>{new Date(a.created_at).toLocaleString()}</Text>
              </View>
              <Text style={styles.status}>{a.resolved ? "Resolved" : "Open"}</Text>
            </Pressable>
          );
        }
        if (item.kind === "call") {
          const c = item.data;
          return (
            <View style={styles.row}>
              <Text style={[styles.badge, styles.badgeCall]}>CALL</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Video call</Text>
                <Text style={styles.date}>{new Date(c.started_at).toLocaleString()}</Text>
              </View>
            </View>
          );
        }
        const c = item.data;
        return (
          <View style={styles.row}>
            <Text style={[styles.badge, styles.badgeCheckIn]}>CHECK-IN</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{c.summary ?? (c.mood ? MOOD_LABEL[c.mood] : "Check-in recorded")}</Text>
              <Text style={styles.date}>{new Date(c.occurred_at).toLocaleString()}</Text>
            </View>
          </View>
        );
      }}
      ListEmptyComponent={<Text style={styles.emptyText}>Nothing recorded yet.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.cream },
  list: { padding: 16, gap: 10, backgroundColor: colors.cream },
  heading: { fontSize: 20, fontWeight: "700", marginBottom: 8, color: colors.navy },
  emptyText: { fontSize: 16, textAlign: "center", color: colors.textMuted },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
  },
  badge: { fontWeight: "700", fontSize: 11, width: 72, textAlign: "center", borderRadius: 6, paddingVertical: 3 },
  badgeAlert: { color: colors.danger, backgroundColor: "#ffe1e1" },
  badgeCall: { color: colors.navy, backgroundColor: colors.peach },
  badgeCheckIn: { color: "#5F7355", backgroundColor: colors.sageLight },
  title: { fontSize: 15, fontWeight: "500", color: colors.text },
  date: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  status: { fontSize: 13, fontWeight: "600", color: "#5F7355" },
});
