import { useCallback, useState } from "react";
import { View, Image, FlatList, Pressable, StyleSheet, ActivityIndicator, Modal } from "react-native";
import Text from "@/components/ScaledText";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/state/useSession";
import { useSharedMedia, type SharedMediaItem } from "@/hooks/useSharedMedia";
import { colors } from "@/theme/colors";

export default function PhotosScreen() {
  const profile = useSession((s) => s.profile);
  const { items, loading, markAllViewed } = useSharedMedia(profile?.id);
  const [viewing, setViewing] = useState<SharedMediaItem | null>(null);

  // Clears the badge on the home screen icon whenever the senior actually
  // looks at this screen, not just when new photos happen to arrive.
  useFocusEffect(
    useCallback(() => {
      markAllViewed();
    }, [markAllViewed])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.terracotta} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) =>
          item.signedUrl ? (
            <Pressable style={styles.thumbWrap} onPress={() => setViewing(item)} accessibilityRole="button" accessibilityLabel="View photo">
              <Image source={{ uri: item.signedUrl }} style={styles.thumb} />
            </Pressable>
          ) : null
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No photos from family yet.</Text>}
      />

      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setViewing(null)} accessibilityRole="button" accessibilityLabel="Close photo">
          {viewing?.signedUrl && <Image source={{ uri: viewing.signedUrl }} style={styles.fullImage} resizeMode="contain" />}
          <View style={styles.closeButton}>
            <Ionicons name="close-circle" size={40} color={colors.white} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream },
  emptyText: { fontSize: 18, textAlign: "center", color: colors.textMuted, marginTop: 60 },
  grid: { padding: 12, gap: 12 },
  row: { gap: 12 },
  thumbWrap: { flex: 1, aspectRatio: 1, borderRadius: 14, overflow: "hidden", backgroundColor: colors.white },
  thumb: { width: "100%", height: "100%" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" },
  fullImage: { width: "100%", height: "80%" },
  closeButton: { position: "absolute", top: 50, right: 20 },
});
