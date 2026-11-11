import { useCallback, useMemo, useRef, useState } from "react";
import { View, Pressable, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import Text from "@/components/ScaledText";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFamilyNotes, type FamilyNoteItem } from "@/hooks/useFamilyNotes";
import { useCallContacts, type CallContact } from "@/hooks/useCallContacts";
import { useSession } from "@/state/useSession";
import { colors } from "@/theme/colors";
import { NOTE_REACTIONS, QUICK_REPLIES } from "@/lib/noteReactions";
import type { NoteReaction } from "@/types/database";

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
  note: FamilyNoteItem;
  senderLabel: string;
  onReact: (noteId: string, reaction: NoteReaction | null) => void;
  onQuickReply: (noteId: string, replyText: string | null) => void;
}) {
  const timeLabel = new Date(note.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // A plain, unmissable confirmation of what the senior sent back -- the
  // selected buttons alone were too subtle to tell a reply had gone through.
  const reactionEmoji = NOTE_REACTIONS.find((r) => r.key === note.reaction)?.emoji;
  const responded = !!reactionEmoji || !!note.reply_text;
  const sentSummary =
    reactionEmoji && note.reply_text
      ? `You sent ${reactionEmoji} and "${note.reply_text}"`
      : reactionEmoji
        ? `You sent ${reactionEmoji}`
        : `You replied "${note.reply_text}"`;

  async function handlePlay() {
    if (!note.audioSignedUrl) return;
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setPlaying(true);
    const { sound } = await Audio.Sound.createAsync({ uri: note.audioSignedUrl }, { shouldPlay: true });
    soundRef.current = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        soundRef.current = null;
        setPlaying(false);
      }
    });
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.sender}>{senderLabel}</Text>
        {note.audio_path && <Ionicons name="mic" size={14} color={colors.terracotta} />}
        <Text style={styles.time}>{timeLabel}</Text>
        {!note.viewed_at && <View style={styles.newDot} />}
      </View>
      {note.audio_path && (
        <Pressable
          style={styles.playButton}
          onPress={handlePlay}
          disabled={playing || !note.audioSignedUrl}
          accessibilityRole="button"
          accessibilityLabel="Play voice note"
        >
          {playing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="play" size={18} color={colors.white} />
          )}
          <Text style={styles.playButtonText}>Play</Text>
        </Pressable>
      )}
      <Text style={styles.noteText}>{note.body}</Text>
      <View style={styles.reactionRow}>
        {NOTE_REACTIONS.map((r) => {
          const selected = note.reaction === r.key;
          return (
            <Pressable
              key={r.key}
              style={[styles.reactionButton, selected && styles.reactionButtonSelected]}
              onPress={() => onReact(note.id, selected ? null : r.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={selected ? `Remove ${r.label} reaction` : `React with ${r.label}`}
              hitSlop={4}
            >
              <Text style={styles.reactionEmoji}>{r.emoji}</Text>
              {selected && (
                <View style={styles.selectedBadge}>
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                </View>
              )}
            </Pressable>
          );
        })}
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
            {note.reply_text === text && <Ionicons name="checkmark-circle" size={18} color={colors.white} />}
            <Text style={[styles.quickReplyText, note.reply_text === text && styles.quickReplyTextSelected]}>{text}</Text>
          </Pressable>
        ))}
      </View>
      {responded && (
        <View style={styles.sentBanner} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={24} color={colors.sage} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sentText}>{sentSummary}</Text>
            <Text style={styles.sentHint}>Tap it again to take it back</Text>
          </View>
        </View>
      )}
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
  sentBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.sageLight,
    borderWidth: 2,
    borderColor: colors.sage,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sentText: { fontSize: 17, fontWeight: "700", color: colors.navy },
  sentHint: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  selectedBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sender: { fontSize: 15, fontWeight: "700", color: colors.navy },
  time: { flex: 1, fontSize: 12, color: colors.textMuted },
  newDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  noteText: { fontSize: 18, lineHeight: 25, color: colors.text },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    backgroundColor: colors.terracotta,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  playButtonText: { color: colors.white, fontSize: 14, fontWeight: "700" },
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
  reactionButtonSelected: { backgroundColor: colors.sageLight, borderColor: colors.sage, borderWidth: 3 },
  reactionEmoji: { fontSize: 22 },
  quickReplyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickReplyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
