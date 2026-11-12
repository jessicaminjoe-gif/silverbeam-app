import { useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, Image, ActivityIndicator, Alert, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { APP_VERSION, PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL, feedbackMailto } from "@/lib/appInfo";
import { useSession } from "@/state/useSession";
import { useLinkedSeniors } from "@/hooks/useLinkedSeniors";
import { pickAndUploadAvatar } from "@/lib/uploadAvatar";
import { SeniorContactSettings } from "@/components/SeniorContactSettings";
import { RedeemInviteForm } from "@/components/RedeemInviteForm";
import { colors } from "@/theme/colors";

export default function SettingsScreen() {
  const profile = useSession((s) => s.profile);
  const setProfile = useSession((s) => s.setProfile);
  const { seniors, loading, reload } = useLinkedSeniors();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  function openFeedback() {
    Linking.openURL(feedbackMailto()).catch(() =>
      Alert.alert("Send us your feedback", `Please email ${SUPPORT_EMAIL} and tell us what you think.`)
    );
  }

  // Two steps on purpose: this can't be undone. The wording spells out the
  // part people don't expect -- a senior with no other family linked goes too.
  function confirmDeleteAccount() {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your account, and the photos, notes and voice notes you sent. If you are the only family member linked to a senior, their SilverBeam account and data are deleted too. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: () =>
            Alert.alert("Are you absolutely sure?", "Your account will be deleted right now.", [
              { text: "Keep my account", style: "cancel" },
              { text: "Yes, delete it", style: "destructive", onPress: deleteAccount },
            ]),
        },
      ]
    );
  }

  async function deleteAccount() {
    setDeleting(true);
    const { error } = await supabase.functions.invoke("delete-account");
    if (error) {
      setDeleting(false);
      Alert.alert("Couldn't delete your account", `Please try again, or email ${SUPPORT_EMAIL} and we'll do it for you.`);
      return;
    }
    // The account no longer exists; this clears the local session and the
    // app returns to the sign-in screen.
    await supabase.auth.signOut().catch(() => {});
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
          ListEmptyComponent={<RedeemInviteForm onConnected={reload} />}
          ListFooterComponent={
            <View style={styles.helpSection}>
              <Text style={styles.subheading}>Help &amp; legal</Text>
              <HelpRow icon="chatbubble-ellipses-outline" label="Send feedback" onPress={() => openFeedback()} />
              <HelpRow icon="shield-checkmark-outline" label="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
              <HelpRow icon="document-text-outline" label="Terms of use" onPress={() => Linking.openURL(TERMS_URL)} />
              <Pressable
                onPress={confirmDeleteAccount}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel="Delete my account"
                style={styles.deleteRow}
              >
                {deleting ? (
                  <ActivityIndicator color={colors.danger} />
                ) : (
                  <Text style={styles.deleteText}>Delete my account</Text>
                )}
              </Pressable>
              <Text style={styles.versionText}>SilverBeam v{APP_VERSION}</Text>
            </View>
          }
        />
      )}

      <Pressable style={styles.signOutButton} onPress={() => supabase.auth.signOut()} accessibilityRole="button">
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

function HelpRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.helpRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={22} color={colors.navy} />
      <Text style={styles.helpLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, backgroundColor: colors.cream },
  helpSection: { gap: 8, marginTop: 16, paddingBottom: 8 },
  helpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  helpLabel: { flex: 1, fontSize: 16, color: colors.navy, fontWeight: "600" },
  deleteRow: { alignItems: "center", paddingVertical: 14, marginTop: 8 },
  deleteText: { fontSize: 15, fontWeight: "600", color: colors.danger, textDecorationLine: "underline" },
  versionText: { textAlign: "center", fontSize: 12, color: colors.textMuted },
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
  signOutButton: {
    marginTop: "auto",
    backgroundColor: colors.navy,
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  signOutText: { color: colors.white, fontSize: 16, fontWeight: "600" },
});
