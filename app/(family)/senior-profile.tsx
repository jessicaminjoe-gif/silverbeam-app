import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useLinkedSeniors } from "@/hooks/useLinkedSeniors";
import type { EscalationEvent } from "@/types/database";

export default function SeniorProfileScreen() {
  const { primarySenior, loading: loadingSeniors } = useLinkedSeniors();
  const [events, setEvents] = useState<EscalationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!primarySenior) return;
    supabase
      .from("escalation_events")
      .select("*")
      .eq("senior_id", primarySenior.seniorId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setEvents((data as EscalationEvent[]) ?? []);
        setLoading(false);
      });
  }, [primarySenior?.seniorId]);

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
        <Text style={styles.emptyText}>No linked senior account yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={events}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.heading}>{primarySenior.fullName} — Alert History</Text>}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() => router.push({ pathname: "/(family)/escalation-detail", params: { id: item.id } })}
        >
          <Text style={styles.severity}>{item.severity.toUpperCase()}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.reason}>{item.trigger_reason ?? "Possible concern"}</Text>
            <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
          <Text style={styles.status}>{item.resolved ? "Resolved" : "Open"}</Text>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>No alerts recorded. That's good news.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  list: { padding: 16, gap: 10 },
  heading: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  emptyText: { fontSize: 16, textAlign: "center", color: "#555" },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: "#f7f7f7",
    borderRadius: 12,
    padding: 14,
  },
  severity: { fontWeight: "700", fontSize: 13, color: "#b00020", width: 60 },
  reason: { fontSize: 15, fontWeight: "500" },
  date: { fontSize: 13, color: "#777", marginTop: 2 },
  status: { fontSize: 13, fontWeight: "600", color: "#2d6a4f" },
});
