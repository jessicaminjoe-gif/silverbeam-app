import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/state/useSession";
import { colors } from "@/theme/colors";
import type { EscalationEvent } from "@/types/database";

export default function EscalationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useSession((s) => s.profile);
  const [event, setEvent] = useState<EscalationEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  async function load() {
    const { data } = await supabase.from("escalation_events").select("*").eq("id", id).single();
    setEvent((data as EscalationEvent) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function handleAcknowledge() {
    if (!event || !profile) return;
    setUpdating(true);
    await supabase
      .from("escalation_events")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: profile.id })
      .eq("id", event.id);
    await load();
    setUpdating(false);
  }

  async function handleResolve() {
    if (!event) return;
    setUpdating(true);
    await supabase
      .from("escalation_events")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", event.id);
    setUpdating(false);
    router.back();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.terracotta} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Alert not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.severity}>{event.severity.toUpperCase()} ALERT</Text>
      <Text style={styles.reason}>{event.trigger_reason ?? "SilverBeam noticed a possible concern."}</Text>
      <Text style={styles.meta}>Detected {new Date(event.created_at).toLocaleString()}</Text>
      {event.detected_keywords?.length ? (
        <Text style={styles.meta}>Signals: {event.detected_keywords.join(", ")}</Text>
      ) : null}

      <Text style={styles.meta}>
        {event.acknowledged_at
          ? `Acknowledged ${new Date(event.acknowledged_at).toLocaleString()}`
          : "Not yet acknowledged"}
      </Text>

      <View style={{ gap: 12, marginTop: 24 }}>
        {!event.acknowledged_at && (
          <Pressable style={styles.button} onPress={handleAcknowledge} disabled={updating} accessibilityRole="button">
            <Text style={styles.buttonText}>Acknowledge</Text>
          </Pressable>
        )}
        {!event.resolved && (
          <Pressable
            style={[styles.button, styles.resolveButton]}
            onPress={handleResolve}
            disabled={updating}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Mark Resolved</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.cream },
  container: { flex: 1, padding: 24, gap: 8, backgroundColor: colors.cream },
  severity: { fontSize: 22, fontWeight: "700", color: colors.danger },
  reason: { fontSize: 18, marginTop: 8, color: colors.text },
  meta: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  emptyText: { fontSize: 16, color: colors.textMuted },
  button: { backgroundColor: colors.terracotta, borderRadius: 10, padding: 16, alignItems: "center" },
  resolveButton: { backgroundColor: colors.navy },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "600" },
});
