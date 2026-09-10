import { useCallback, useMemo } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFamilyNotes } from "@/hooks/useFamilyNotes";
import { useCallContacts, type CallContact } from "@/hooks/useCallContacts";
import { useSession } from "@/state/useSession";
import { colors } from "@/theme/colors";
import { NOTE_REACTIONS, QUICK_REPLIES } from "@/lib/noteReactions";
import type { FamilyNote, NoteReaction } from "@/types/database";

export default function LoveNotesScreen() {
  const insets = useSafeAreaInsets();
  const profile = useSession((s) => s.profile);
  const { notes, loading, markAllViewed, setReaction, setReplyText } = useFamilyNotes(profile?.id);
  const { contacts } = useCallContacts();

  const contactsById = useMemo(() => {
    const map = new Map<string, CallContact>();
    for (const c of contacts) map.set(c.familyMemberId, c);
    return map;
  }, [contacts]);

  function senderLabel(senderId: string): string {
    const contact = contactsById.get(senderId);
    return contact?.relationship || contact?.fullName || "Family";
  }

  // Clears the badge on the board the moment the senior actually looks at
  // this screen, not just when a new note happens to arrive.
  useFocusEffect(
    useCallback(() => {
      markAllViewed();
    }, [markAllViewed])
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color={colors.navy} />
        </Pressable>
        <Text style={styles.headerTitle}>Love Notes</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.terracotta} />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <NoteCard note={item} senderLabel={senderLabel(item.sender_id)} onReact={setReaction} onQuickReply={setReplyText} />
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No notes from family yet.</Text>}
        />
      )}
    </View>
  );
}

function NoteCard({
  note,
  senderLabel,
  onReact,
  onQuickReply,
}: {
  note: FamilyNote;
  senderLabel: string;
  onReact: (noteId: string, reaction: NoteReaction | null) => void;
  onQuickReply: (noteId: string, replyText: string | null) => void;
}) {
  const timeLabel = new Date(note.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.sender}>{senderLabel}</Text>
        <Text style={styles.time}>{timeLabel}</Text>
        {!note.viewed_at && <View style={styles.newDot} />}
      </View>
      <Text style={styles.noteText}>{note.body}</Text>
      <View style={styles.reactionRow}>
        {NOTE_REACTIONS.map((r) => (
          <Pressable
            key={r.key}
            style={[styles.reactionButton, note.reaction === r.key && styles.reactionButtonSelected]}
            onPress={() => onReact(note.id, note.reaction === r.key ? null : r.key)}
            accessibilityRole="button"
            accessibilityLabel={note.reaction === r.key ? `Remove ${r.label} reaction` : `React with ${r.label}`}
            hitSlop={4}
          >
            <Text style={styles.reactionEmoji}>{r.emoji}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.quickReplyRow}>
        {QUICK_REPLIES.map((text) => (
          <Pressable
            key={text}
            style={[styles.quickReplyButton, note.reply_text === text && styles.quickReplyButtonSelected]}
            onPress={() => onQuickReply(note.id, note.reply_text === text ? null : text)}
            accessibilityRole="button"
            accessibilityLabel={note.reply_text === text ? `Remove reply "${text}"` : `Reply "${text}"`}
          >
            <Text style={[styles.quickReplyText, note.reply_text === text && styles.quickReplyTextSelected]}>{text}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: colors.navy },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  emptyText: { fontSize: 18, textAlign: "center", color: colors.textMuted, marginTop: 40, paddingHorizontal: 20 },
  card: { backgroundColor: colors.white, borderRadius: 14, padding: 16, gap: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sender: { fontSize: 15, fontWeight: "700", color: colors.navy },
  time: { flex: 1, fontSize: 12, color: colors.textMuted },
  newDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  noteText: { fontSize: 18, lineHeight: 25, color: colors.text },
  reactionRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  reactionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionButtonSelected: { backgroundColor: colors.sageLight, borderColor: colors.sage },
  reactionEmoji: { fontSize: 22 },
  quickReplyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickReplyButton: {
    borderWidth: 1,
    borderColor: colors.terracotta,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  quickReplyButtonSelected: { backgroundColor: colors.terracotta },
  quickReplyText: { fontSize: 14, fontWeight: "600", color: colors.terracotta },
  quickReplyTextSelected: { color: colors.white },
});
