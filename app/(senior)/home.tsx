import { useCallback, useState } from "react";
import { View, Image, Pressable, FlatList, StyleSheet, ActivityIndicator, Platform, Linking, Alert, useWindowDimensions } from "react-native";
import { useIsTablet } from "@/lib/device";
import Text from "@/components/ScaledText";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { speak } from "@/lib/speech";
import { useCompanionSettings } from "@/hooks/useCompanionSettings";
import { useDailyBriefing } from "@/hooks/useDailyBriefing";
import { useCallContacts } from "@/hooks/useCallContacts";
import { useEmergencyContact } from "@/hooks/useEmergencyContact";
import { useSharedMedia } from "@/hooks/useSharedMedia";
import { useFamilyNotes } from "@/hooks/useFamilyNotes";
import { useSession } from "@/state/useSession";
import { colors } from "@/theme/colors";
import type { BoardTileKey } from "@/types/database";

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

interface TileDef {
  key: BoardTileKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  fg: string;
  route: string;
}

// Fixed order and look for every possible tile -- family's board_tiles
// setting (see SeniorContactSettings.tsx) just filters which of these
// actually render, it doesn't reorder or restyle them. Let's Connect,
// Check In, and Weather each get their own distinct dark tone; the
// content-browsing tiles (Photos, Love Notes, Headlines, On This Day)
// share the lighter peach so the board reads as "act on it" (bold) vs.
// "look at it" (soft) rather than seven arbitrary colors.
const TILE_DEFS: TileDef[] = [
  { key: "call", label: "Let's Connect", icon: "videocam", bg: colors.terracotta, fg: colors.white, route: "/(senior)/call-picker" },
  { key: "photos", label: "Photos", icon: "images", bg: colors.peach, fg: colors.navy, route: "/(senior)/photos" },
  { key: "notes", label: "Love Notes", icon: "heart", bg: colors.peach, fg: colors.navy, route: "/(senior)/love-notes" },
  { key: "checkin", label: "Check In", icon: "happy", bg: colors.sage, fg: colors.white, route: "/(senior)/checkin" },
  { key: "weather", label: "Weather", icon: "partly-sunny", bg: colors.navy, fg: colors.white, route: "/(senior)/weather" },
  { key: "headlines", label: "Headlines", icon: "newspaper", bg: colors.peach, fg: colors.navy, route: "/(senior)/headlines" },
  { key: "onThisDay", label: "On This Day", icon: "time", bg: colors.peach, fg: colors.navy, route: "/(senior)/on-this-day" },
  { key: "myDay", label: "My Day", icon: "calendar", bg: colors.sage, fg: colors.white, route: "/(senior)/my-day" },
  { key: "music", label: "My Music", icon: "musical-notes", bg: colors.peach, fg: colors.navy, route: "/(senior)/music" },
];

// The Beam Board: a grid of tiles for the things family and the senior do
// most, with the AI companion as a smaller "Ask {name}" button below the
// board rather than a tile itself -- see the brainstorm that led here.
export default function SeniorHomeScreen() {
  const insets = useSafeAreaInsets();
  const profile = useSession((s) => s.profile);
  const { settings } = useCompanionSettings(profile?.id);
  const { contacts } = useCallContacts();
  const { contact: emergencyContact } = useEmergencyContact();
  const { unreadCount: unreadPhotoCount, reload: reloadPhotos } = useSharedMedia(profile?.id);
  const { unreadCount: unreadNoteCount, reload: reloadNotes } = useFamilyNotes(profile?.id);
  useDailyBriefing(profile?.id, true);

  const seniorDisplayName = settings.senior_nickname || profile?.full_name?.split(" ")[0] || "there";

  function handleEmergencyPress() {
    if (!emergencyContact) {
      Alert.alert("No emergency contact", "No emergency contact phone on file — ask family to add one in Settings.");
      return;
    }
    Linking.openURL(`tel:${emergencyContact.phone}`);
  }

  function senderLabel(senderId: string): string {
    const contact = contacts.find((c) => c.familyMemberId === senderId);
    return contact?.relationship || contact?.fullName || "Family";
  }

  // Announces new photos/notes the moment they arrive while the app is
  // open (the push notification covers the app-closed case); also keeps
  // the tile badges current without needing the senior to back out and
  // back in to this screen.
  useFocusEffect(
    useCallback(() => {
      if (!profile?.id) return;
      const channel = supabase
        .channel(`beam-board:${profile.id}`)
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
            speak(`${senderLabel(senderId)} sent you a love note!`);
          }
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.id, contacts, reloadPhotos, reloadNotes])
  );

  const visibleTiles = TILE_DEFS.filter((t) => settings.board_tiles[t.key]);

  // Tile sizing. On a phone this works out to the same squarish tiles as
  // before. On a tablet, width-based tiles got so tall that the last row sat
  // below the fold, so: 3 columns when there are more than 4 tiles, and no
  // tile taller than what lets every row fit on screen.
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = useIsTablet();
  const [listHeight, setListHeight] = useState(0);
  const columns = isTablet && visibleTiles.length > 4 ? 3 : 2;
  const rows = Math.max(1, Math.ceil(visibleTiles.length / columns));
  const tileWidth = (windowWidth - GRID_PADDING_X * 2 - GRID_GAP * (columns - 1)) / columns;
  // Tablets have spare height, so tiles may be taller than squarish there.
  const widthBasedHeight = isTablet ? tileWidth * 1.3 : tileWidth / 1.1;
  const fitHeight = listHeight > 0 ? (listHeight - GRID_PADDING_BOTTOM - GRID_GAP * (rows - 1)) / rows : widthBasedHeight;
  const tileHeight = Math.max(MIN_TILE_HEIGHT, Math.min(widthBasedHeight, fitHeight));
  const tileIconSize = isTablet ? 56 : 40;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Image source={logoSource} style={styles.logoIcon} />
        <Text style={styles.greeting} numberOfLines={2}>
          {getGreeting()}, {seniorDisplayName}!
        </Text>
        <Pressable
          style={styles.emergencyButton}
          onPress={handleEmergencyPress}
          accessibilityRole="button"
          accessibilityLabel="Call emergency contact"
        >
          <Ionicons name="call" size={26} color={colors.white} />
        </Pressable>
      </View>

      <FlatList
        // numColumns can't change on a mounted FlatList, so remount when it does.
        key={columns}
        data={visibleTiles}
        keyExtractor={(item) => item.key}
        numColumns={columns}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
        renderItem={({ item }) => {
          const disabled = item.key === "call" && !settings.video_call_enabled;
          const badge = item.key === "photos" ? unreadPhotoCount : item.key === "notes" ? unreadNoteCount : 0;
          return (
            <Pressable
              style={[styles.tile, { height: tileHeight, backgroundColor: disabled ? colors.sageLight : item.bg }, disabled && styles.tileDisabled]}
              onPress={() => router.push(item.route as never)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={disabled ? `${item.label}, turned off` : badge > 0 ? `${item.label}, ${badge} new` : item.label}
            >
              <Ionicons name={item.icon} size={tileIconSize} color={disabled ? colors.textMuted : item.fg} />
              <Text style={[styles.tileLabel, { color: disabled ? colors.textMuted : item.fg }]}>{item.label}</Text>
              {badge > 0 && <View style={styles.tileBadge} />}
            </Pressable>
          );
        }}
      />

      <Pressable
        style={[styles.askButton, { marginBottom: insets.bottom + 12 }]}
        onPress={() => router.push("/(senior)/chat")}
        accessibilityRole="button"
        accessibilityLabel={`Ask ${settings.companion_name}`}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color={colors.white} />
        <Text style={styles.askButtonText}>Ask {settings.companion_name}</Text>
      </Pressable>
    </View>
  );
}

const GRID_PADDING_X = 16;
const GRID_PADDING_BOTTOM = 12;
const GRID_GAP = 14;
const MIN_TILE_HEIGHT = 120;

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
  emergencyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
  },
  grid: { paddingHorizontal: GRID_PADDING_X, paddingBottom: GRID_PADDING_BOTTOM, gap: GRID_GAP, flexGrow: 1 },
  row: { gap: GRID_GAP },
  tile: {
    flex: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  tileDisabled: { opacity: 0.7 },
  tileLabel: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  tileBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
  },
  askButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.terracotta,
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 16,
    // A touch of shadow/elevation so it reads as a real button sitting on
    // top of the board, not just another flat row -- was too easy to miss
    // as an outline-only button per feedback after real testing.
    shadowColor: colors.navy,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  askButtonText: { fontSize: 18, fontWeight: "800", color: colors.white },
});
