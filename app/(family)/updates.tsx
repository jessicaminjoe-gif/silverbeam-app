import { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useActiveSenior } from "@/hooks/useActiveSenior";
import { SeniorSwitcher } from "@/components/SeniorSwitcher";
import { colors } from "@/theme/colors";
import { NOTE_REACTION_EMOJI } from "@/lib/noteReactions";
import type { CheckIn, EscalationEvent, FamilyNote } from "@/types/database";
import { supabase } from "@/lib/supabase";

const RECENT_NOTES_LIMIT = 10;

const MOOD_EMOJI: Record<string, string> = {
  great: "😊",
  okay: "🙂",
  not_great: "😕",
  rough: "😣",
};

// What's new since you last looked: open alerts up top, then the senior's
// check-ins -- split out of Home (dashboard.tsx) so that screen stays a
// quick-action pad rather than a feed to scroll through.
export default function UpdatesScreen() {
  const { activeSenior, seniors, loading: loadingSeniors, setActiveSeniorId } = useActiveSenior();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [activeEscalations, setActiveEscalations] = useState<EscalationEvent[]>([]);
  const [recentNotes, setRecentNotes] = useState<FamilyNote[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeSenior) return;
    const [{ data: checkInData }, { data: escalationData }, { data: noteData }] = await Promise.all([
      supabase
        .from("check_ins")
        .select("*")
        .eq("senior_id", activeSenior.seniorId)
        .order("occurred_at", { ascending: false })
        .limit(30),
      supabase
        .from("escalation_events")
        .select("*")
        .eq("senior_id", activeSenior.seniorId)
        .eq("resolved", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("family_notes")
        .select("*")
        .eq("senior_id", activeSenior.seniorId)
        .order("created_at", { ascending: false })
        .limit(RECENT_NOTES_LIMIT),
    ]);
    setCheckIns((checkInData as CheckIn[]) ?? []);
    setActiveEscalations((escalationData as EscalationEvent[]) ?? []);
    setRecentNotes((noteData as FamilyNote[]) ?? []);
    setLoading(false);
  }, [activeSenior?.seniorId]);

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

  if (!activeSenior) {
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
          <SeniorSwitcher activeSenior={activeSenior} seniors={seniors} onSwitch={setActiveSeniorId} />

          <Text style={styles.heading}>Updates From {activeSenior.fullName}</Text>

          {activeEscalations.map((e) => (
            <Pressable
              key={e.id}
              style={[styles.alertBanner, e.severity === "high" ? styles.alertHigh : styles.alertMedium]}
              onPress={() => router.push({ pathname: "/(family)/escalation-detail", params: { id: e.id } })}
            >
              <Text style={styles.alertText}>
                {e.severity.toUpperCase()} alert — {e.trigger_reason ?? "possible concern"}. Tap for details.
              </Text>
              <Text style={styles.alertDate}>{new Date(e.created_at).toLocaleString()}</Text>
            </Pressable>
          ))}

          {recentNotes.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={styles.subheading}>Love Notes</Text>
              {recentNotes.map((note) => (
                <View key={note.id} style={styles.noteRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.noteBody} numberOfLines={2}>
                      {note.body}
                    </Text>
                    <Text style={styles.date}>{new Date(note.created_at).toLocaleString()}</Text>
                    {note.reply_text && <Text style={styles.noteReplyText}>"{note.reply_text}"</Text>}
                  </View>
                  {note.reaction ? (
                    <Text style={styles.noteReactionEmoji}>{NOTE_REACTION_EMOJI[note.reaction]}</Text>
                  ) : !note.reply_text ? (
                    <Text style={styles.noteReactionPending}>No reply yet</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          <Text style={styles.subheading}>Check-ins</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.checkInRow}>
          <Text style={styles.moodEmoji}>{item.mood_emoji ?? (item.mood ? MOOD_EMOJI[item.mood] : "•")}</Text>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.cream },
  list: { padding: 16, gap: 10, backgroundColor: colors.cream },
  heading: { fontSize: 20, fontWeight: "700", color: colors.navy },
  subheading: { fontSize: 15, fontWeight: "600", color: colors.textMuted },
  emptyText: { fontSize: 16, textAlign: "center", color: colors.textMuted },
  checkInRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
  },
  moodEmoji: { fontSize: 28 },
  summary: { fontSize: 16, fontWeight: "500", color: colors.text },
  date: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  alertBanner: { borderRadius: 12, padding: 14 },
  alertHigh: { backgroundColor: "#ffd6d6" },
  alertMedium: { backgroundColor: "#ffe8c2" },
  alertText: { fontSize: 15, fontWeight: "600", color: colors.navy },
  alertDate: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
  },
  noteBody: { fontSize: 15, color: colors.text },
  noteReplyText: { fontSize: 13, color: colors.terracotta, fontStyle: "italic", marginTop: 4 },
  noteReactionEmoji: { fontSize: 26 },
  noteReactionPending: { fontSize: 12, color: colors.textMuted, fontStyle: "italic" },
});
