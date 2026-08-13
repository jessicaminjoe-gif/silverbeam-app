import { useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, Image, ActivityIndicator, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/state/useSession";
import { useLinkedSeniors } from "@/hooks/useLinkedSeniors";
import { pickAndUploadAvatar } from "@/lib/uploadAvatar";
import { SeniorContactSettings } from "@/components/SeniorContactSettings";
import { colors } from "@/theme/colors";

export default function SettingsScreen() {
  const profile = useSession((s) => s.profile);
  const setProfile = useSession((s) => s.setProfile);
  const { seniors, loading, reload } = useLinkedSeniors();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function handleChangeAvatar() {
    if (!profile) return;
    setUploadingAvatar(true);
    try {
      const url = await pickAndUploadAvatar(profile.id);
      if (!url) return;
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
      if (error) throw error;
      setProfile({ ...profile, avatar_url: url });
    } catch {
      Alert.alert("Couldn't update photo", "Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.profileCard}>
        <Pressable onPress={handleChangeAvatar} disabled={uploadingAvatar} accessibilityRole="button" accessibilityLabel="Change your photo">
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{profile?.full_name?.[0]?.toUpperCase() ?? "?"}</Text>
            </View>
          )}
          {uploadingAvatar && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color={colors.white} />
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>{profile?.full_name}</Text>
          <Pressable onPress={handleChangeAvatar} disabled={uploadingAvatar}>
            <Text style={styles.changePhotoText}>Change photo</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.subheading}>Linked seniors</Text>

      {!loading && (
        <FlatList
          data={seniors}
          keyExtractor={(item) => item.linkId}
          renderItem={({ item }) => <SeniorContactSettings senior={item} onChanged={reload} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Not linked to anyone yet. Contact the SilverBeam team to get connected to your family member's
              account.
            </Text>
          }
        />
      )}

      <Pressable style={styles.signOutButton} onPress={() => supabase.auth.signOut()} accessibilityRole="button">
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, backgroundColor: colors.cream },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { backgroundColor: colors.sageLight, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 28, fontWeight: "700", color: colors.navy },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { fontSize: 24, fontWeight: "700", color: colors.navy },
  changePhotoText: { fontSize: 14, fontWeight: "600", color: colors.terracotta, marginTop: 4 },
  subheading: { fontSize: 16, fontWeight: "600", color: colors.textMuted, marginTop: 8 },
  emptyText: { fontSize: 15, color: colors.textMuted },
  signOutButton: {
    marginTop: "auto",
    backgroundColor: colors.navy,
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  signOutText: { color: colors.white, fontSize: 16, fontWeight: "600" },
});
