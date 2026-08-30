import { useCallback, useMemo, useState } from "react";
import { View, Text, Image, Pressable, FlatList, StyleSheet, ActivityIndicator, Platform, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { speak } from "@/lib/speech";
import { useCompanionSettings } from "@/hooks/useCompanionSettings";
import { useDailyBriefing } from "@/hooks/useDailyBriefing";
import { useCallContacts, type CallContact } from "@/hooks/useCallContacts";
import { useSharedMedia, type SharedMediaItem } from "@/hooks/useSharedMedia";
import { useFamilyNotes } from "@/hooks/useFamilyNotes";
import { useSession } from "@/state/useSession";
import { colors } from "@/theme/colors";
import type { FamilyNote } from "@/types/database";

// expo export --platform web doesn't resolve local require()'d image
// sources correctly in the static bundle — see (auth)/login.tsx for the
// same workaround (this screen is native-only in practice, but matching
// the proven pattern removes any doubt).
const logoSource = Platform.OS === "web" ? { uri: "/brand-icon.png" } : require("../../assets/icon.png");

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type FeedItem =
  | { kind: "photo"; id: string; senderId: string; createdAt: string; viewed: boolean; item: SharedMediaItem }
  | { kind: "note"; id: string; senderId: string; createdAt: string; viewed: boolean; item: FamilyNote };

// Family-first home: the senior's first view of the app is their family --
// who to call, and what family has recently sent -- with the AI companion
// one tap away via the Chat button, not the default view. See chat.tsx for
// where the conversation UI moved.
export default function SeniorHomeScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const profile = useSession((s) => s.profile);
  const [soundEnabled] = useState(true);
  const { settings } = useCompanionSettings(profile?.id);
  const { contacts, loading: loadingContacts } = useCallContacts();
  const {
    items: photos,
    unreadCount: unreadPhotoCount,
    loading: loadingPhotos,
    reload: reloadPhotos,
    markAllViewed: markPhotosViewed,
  } = useSharedMedia(profile?.id);
  const { notes, loading: loadingNotes, reload: reloadNotes, markAllViewed: markNotesViewed } = useFamilyNotes(profile?.id);
  useDailyBriefing(profile?.id, soundEnabled);

  const seniorDisplayName = settings.senior_nickname || profile?.full_name?.split(" ")[0] || "there";

  const contactsById = useMemo(() => {
    const map = new Map<string, CallContact>();
    for (const c of contacts) map.set(c.familyMemberId, c);
    return map;
  }, [contacts]);

  function senderLabel(senderId: string): string {
    const contact = contactsById.get(senderId);
    return contact?.relationship || contact?.fullName || "Family";
  }

  const feed: FeedItem[] = useMemo(() => {
    const photoItems: FeedItem[] = photos.map((p) => ({
      kind: "photo",
      id: p.id,
      senderId: p.sender_id,
      createdAt: p.created_at,
      viewed: !!p.viewed_at,
      item: p,
    }));
    const noteItems: FeedItem[] = notes.map((n) => ({
      kind: "note",
      id: n.id,
      senderId: n.sender_id,
      createdAt: n.created_at,
      viewed: !!n.viewed_at,
      item: n,
    }));
    return [...photoItems, ...noteItems].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [photos, notes]);

  // Clears both badges the moment the senior actually looks at the feed,
  // not just when new items happen to arrive. Both mark-viewed functions
  // are recreated (via useCallback in their hooks) whenever their item
  // list changes, so they're included here deliberately -- omitting them
  // would freeze this effect's closure onto a stale, possibly-empty items
  // array from an earlier render and silently stop marking anything read.
  useFocusEffect(
    useCallback(() => {
      markPhotosViewed();
      markNotesViewed();
    }, [markPhotosViewed, markNotesViewed])
  );

  // Announces new photos/notes the moment they arrive while the app is
  // open (the push notification covers the app-closed case).
  useFocusEffect(
    useCallback(() => {
      if (!profile?.id) return;
      const channel = supabase
        .channel(`family-feed:${profile.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "shared_media", filter: `senior_id=eq.${profile.id}` },
          (payload) => {
            reloadPhotos();
            const senderId = (payload.new as { sender_id: string }).sender_id;
            speak(`${senderLabel(senderId)} sent you new photos!`);
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "family_notes", filter: `senior_id=eq.${profile.id}` },
          (payload) => {
            reloadNotes();
            const senderId = (payload.new as { sender_id: string }).sender_id;
            speak(`${senderLabel(senderId)} sent you a note!`);
          }
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }, [profile?.id, contactsById, reloadPhotos, reloadNotes])
  );

  const loading = loadingContacts || loadingPhotos || loadingNotes;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Image source={logoSource} style={styles.logoIcon} />
        <Text style={styles.greeting} numberOfLines={1}>
          {getGreeting()}, {seniorDisplayName}!
        </Text>
      </View>

      <View style={[styles.topButtonRow, { minHeight: windowHeight * 0.33 }]}>
        <Pressable
          style={styles.videoCallButton}
          onPress={() => router.push("/(senior)/call-picker")}
          accessibilityRole="button"
          accessibilityLabel="Video Call"
        >
          <Ionicons name="videocam" size={48} color={colors.white} />
          <Text style={styles.videoCallButtonText}>Video Call</Text>
        </Pressable>
        <Pressable
          style={styles.photosButton}
          onPress={() => router.push("/(senior)/photos")}
          accessibilityRole="button"
          accessibilityLabel={unreadPhotoCount > 0 ? `Photos, ${unreadPhotoCount} new` : "Photos"}
        >
          <Ionicons name="images" size={48} color={colors.navy} />
          <Text style={styles.photosButtonText}>Photos</Text>
          {unreadPhotoCount > 0 && <View style={styles.photosButtonBadge} />}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.terracotta} />
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={styles.feedList}
          renderItem={({ item }) => <FeedCard item={item} senderLabel={senderLabel(item.senderId)} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nothing from family yet. When they send a photo or note, it'll show up here.</Text>
          }
        />
      )}

      <View style={[styles.actionRow, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={styles.checkinButton}
          onPress={() => router.push("/(senior)/checkin")}
          accessibilityRole="button"
          accessibilityLabel="Daily Check In"
        >
          <Ionicons name="happy" size={26} color={colors.navy} />
          <Text style={styles.checkinButtonText}>Check In</Text>
        </Pressable>
        <Pressable
          style={styles.chatButton}
          onPress={() => router.push("/(senior)/chat")}
          accessibilityRole="button"
          accessibilityLabel={`Chat with ${settings.companion_name}`}
        >
          <Ionicons name="chatbubble-ellipses" size={26} color={colors.white} />
          <Text style={styles.chatButtonText}>Chat with {settings.companion_name}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FeedCard({ item, senderLabel }: { item: FeedItem; senderLabel: string }) {
  const timeLabel = new Date(item.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  if (item.kind === "photo") {
    return (
      <Pressable
        style={styles.feedCard}
        onPress={() => router.push("/(senior)/photos")}
        accessibilityRole="button"
        accessibilityLabel={`Photo from ${senderLabel}`}
      >
        <View style={styles.feedCardHeader}>
          <Text style={styles.feedSender}>{senderLabel}</Text>
          <Text style={styles.feedTime}>{timeLabel}</Text>
          {!item.viewed && <View style={styles.newDot} />}
        </View>
        {item.item.signedUrl && <Image source={{ uri: item.item.signedUrl }} style={styles.feedPhoto} />}
        {item.item.caption && <Text style={styles.feedCaption}>{item.item.caption}</Text>}
      </Pressable>
    );
  }

  return (
    <View style={styles.feedCard}>
      <View style={styles.feedCardHeader}>
        <Text style={styles.feedSender}>{senderLabel}</Text>
        <Text style={styles.feedTime}>{timeLabel}</Text>
        {!item.viewed && <View style={styles.newDot} />}
      </View>
      <Text style={styles.feedNoteText}>{item.item.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  logoIcon: { width: 44, height: 44, borderRadius: 12 },
  greeting: { flex: 1, fontSize: 24, fontWeight: "700", color: colors.navy },
  topButtonRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  videoCallButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.terracotta,
    borderRadius: 18,
  },
  videoCallButtonText: { fontSize: 22, fontWeight: "800", color: colors.white },
  photosButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.sageLight,
    borderRadius: 18,
  },
  photosButtonText: { fontSize: 22, fontWeight: "800", color: colors.navy },
  photosButtonBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
  },
  feedList: { paddingHorizontal: 16, paddingBottom: 12, gap: 12, flexGrow: 1 },
  emptyText: { fontSize: 18, textAlign: "center", color: colors.textMuted, marginTop: 40, paddingHorizontal: 20 },
  feedCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, gap: 8 },
  feedCardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  feedSender: { fontSize: 15, fontWeight: "700", color: colors.navy },
  feedTime: { flex: 1, fontSize: 12, color: colors.textMuted },
  newDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  feedPhoto: { width: "100%", aspectRatio: 4 / 3, borderRadius: 10, backgroundColor: colors.sageLight },
  feedCaption: { fontSize: 15, color: colors.text },
  feedNoteText: { fontSize: 17, lineHeight: 24, color: colors.text },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.cream,
  },
  checkinButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.sageLight,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  checkinButtonText: { fontSize: 17, fontWeight: "700", color: colors.navy },
  chatButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.terracotta,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  chatButtonText: { fontSize: 17, fontWeight: "700", color: colors.white },
});
