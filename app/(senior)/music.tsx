import { View, Pressable, ScrollView, StyleSheet, ActivityIndicator, Linking, Alert } from "react-native";
import Text from "@/components/ScaledText";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMusicLinks } from "@/hooks/useMusicLinks";
import { useSession } from "@/state/useSession";
import { colors } from "@/theme/colors";

export default function MusicScreen() {
  const insets = useSafeAreaInsets();
  const profile = useSession((s) => s.profile);
  const { links, loading } = useMusicLinks(profile?.id);

  async function openLink(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Couldn't open this link", "Please ask your family to check it.");
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color={colors.navy} />
        </Pressable>
        <Text style={styles.headerTitle}>My Music</Text>
      </View>

      {loading ? (
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
              onPress={() => openLink(link.url)}
              accessibilityRole="button"
              accessibilityLabel={`Play ${link.label}`}
            >
              <Ionicons name="musical-notes" size={36} color={colors.white} />
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
  headerTitle: { fontSize: 24, fontWeight: "700", color: colors.navy },
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
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  emptyText: { fontSize: 20, textAlign: "center", color: colors.textMuted, lineHeight: 28 },
});
