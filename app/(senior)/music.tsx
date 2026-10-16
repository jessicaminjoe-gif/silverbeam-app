import { useState } from "react";
import { View, Pressable, ScrollView, StyleSheet, ActivityIndicator, Linking, Alert } from "react-native";
import Text from "@/components/ScaledText";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MusicPlayer } from "@/components/MusicPlayer";
import { useMusicLinks } from "@/hooks/useMusicLinks";
import { getEmbed } from "@/lib/musicEmbed";
import { useSession } from "@/state/useSession";
import { colors } from "@/theme/colors";
import type { MusicLink } from "@/types/database";

export default function MusicScreen() {
  const insets = useSafeAreaInsets();
  const profile = useSession((s) => s.profile);
  const { links, loading } = useMusicLinks(profile?.id);
  const [playing, setPlaying] = useState<{ link: MusicLink; embedUrl: string } | null>(null);

  async function handlePress(link: MusicLink) {
    const embed = getEmbed(link.url);
    if (embed) {
      setPlaying({ link, embedUrl: embed.embedUrl });
      return;
    }
    // A link saved before in-app playback existed (e.g. Pandora) can't be
    // embedded -- open it in its own app like before rather than break it.
    try {
      await Linking.openURL(link.url);
    } catch {
      Alert.alert("Couldn't open this link", "Please ask your family to check it.");
    }
  }

  function handleBack() {
    if (playing) setPlaying(null);
    else router.back();
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} accessibilityRole="button" accessibilityLabel={playing ? "Stop music and go back" : "Back"} hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color={colors.navy} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {playing ? playing.link.label : "My Music"}
        </Text>
      </View>

      {playing ? (
        <View style={styles.nowPlaying}>
          <View style={styles.player}>
            <MusicPlayer embedUrl={playing.embedUrl} />
          </View>
          <Pressable
            style={[styles.stopButton, { marginBottom: insets.bottom + 16 }]}
            onPress={() => setPlaying(null)}
            accessibilityRole="button"
            accessibilityLabel="Stop music"
          >
            <Ionicons name="stop" size={32} color={colors.white} />
            <Text style={styles.stopText}>Stop music</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.terracotta} />
      ) : links.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="musical-notes" size={56} color={colors.textMuted} />
          <Text style={styles.emptyText}>Your family hasn't added any music yet. Ask them to add some in Settings.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {links.map((link) => (
            <Pressable
              key={link.id}
              style={styles.linkButton}
              onPress={() => handlePress(link)}
              accessibilityRole="button"
              accessibilityLabel={`Play ${link.label}`}
            >
              <Ionicons name="play-circle" size={40} color={colors.white} />
              <Text style={styles.linkText}>{link.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { flex: 1, fontSize: 24, fontWeight: "700", color: colors.navy },
  list: { padding: 16, gap: 16 },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: colors.navy,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  linkText: { flex: 1, fontSize: 24, fontWeight: "800", color: colors.white },
  nowPlaying: { flex: 1, paddingHorizontal: 16, gap: 16 },
  player: { flex: 1, borderRadius: 16, overflow: "hidden", backgroundColor: "#000" },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.danger,
    borderRadius: 20,
    paddingVertical: 24,
  },
  stopText: { fontSize: 26, fontWeight: "800", color: colors.white },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  emptyText: { fontSize: 20, textAlign: "center", color: colors.textMuted, lineHeight: 28 },
});
