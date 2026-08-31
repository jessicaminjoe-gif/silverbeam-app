import { useState } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Pressable, Alert, Modal } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useActiveSenior } from "@/hooks/useActiveSenior";
import { useCompanionSettings } from "@/hooks/useCompanionSettings";
import { SeniorSwitcher } from "@/components/SeniorSwitcher";
import { pickAndSharePhoto } from "@/lib/uploadPhoto";
import { sendNoteToSenior } from "@/lib/sendNote";
import { colors } from "@/theme/colors";

const MAX_NOTE_LENGTH = 500;

// Home: the three things family does most -- call, send a photo, send a
// note. Check-ins and alerts moved to their own Updates tab (updates.tsx)
// so this stays a quick action screen, not a feed to scroll through.
export default function DashboardScreen() {
  const { activeSenior, seniors, loading: loadingSeniors, setActiveSeniorId } = useActiveSenior();
  const { settings } = useCompanionSettings(activeSenior?.seniorId);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [sendingNote, setSendingNote] = useState(false);

  async function handleSendPhoto() {
    if (!activeSenior) return;
    setSendingPhoto(true);
    try {
      const sent = await pickAndSharePhoto(activeSenior.seniorId);
      if (sent) Alert.alert("Sent!", `${activeSenior.fullName} will be notified.`);
    } catch {
      Alert.alert("Couldn't send photo", "Please try again.");
    } finally {
      setSendingPhoto(false);
    }
  }

  async function handleSendNote() {
    if (!activeSenior || !noteText.trim()) return;
    setSendingNote(true);
    try {
      await sendNoteToSenior(activeSenior.seniorId, noteText.trim());
      setNoteModalOpen(false);
      setNoteText("");
      Alert.alert("Sent!", `${activeSenior.fullName} will be notified.`);
    } catch {
      Alert.alert("Couldn't send note", "Please try again.");
    } finally {
      setSendingNote(false);
    }
  }

  if (loadingSeniors) {
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
    <>
      <View style={styles.screen}>
        <SeniorSwitcher activeSenior={activeSenior} seniors={seniors} onSwitch={setActiveSeniorId} />

        <View style={styles.actionColumn}>
          <Pressable
            style={[styles.actionButton, !settings.video_call_enabled && styles.actionButtonDisabled]}
            onPress={() => router.push({ pathname: "/(family)/call-outbound", params: { seniorId: activeSenior.seniorId } })}
            disabled={!settings.video_call_enabled}
            accessibilityRole="button"
            accessibilityLabel={
              settings.video_call_enabled ? `Video call ${activeSenior.fullName}` : "Video calling is turned off in Settings"
            }
          >
            <Ionicons name="videocam" size={28} color={settings.video_call_enabled ? colors.white : colors.textMuted} />
            <Text style={[styles.actionButtonText, !settings.video_call_enabled && styles.actionButtonTextDisabled]}>
              {settings.video_call_enabled ? "Video Call" : "Video Call Off"}
            </Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={handleSendPhoto}
            disabled={sendingPhoto}
            accessibilityRole="button"
            accessibilityLabel={`Send a photo to ${activeSenior.fullName}`}
          >
            {sendingPhoto ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons name="image" size={28} color={colors.white} />
            )}
            <Text style={styles.actionButtonText}>Send Photo</Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => setNoteModalOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Send a note to ${activeSenior.fullName}`}
          >
            <Ionicons name="chatbubble-ellipses" size={28} color={colors.white} />
            <Text style={styles.actionButtonText}>Send Note</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={noteModalOpen} transparent animationType="fade" onRequestClose={() => setNoteModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Send {activeSenior?.fullName} a note</Text>
            <TextInput
              style={styles.modalInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="What would you like to say?"
              multiline
              maxLength={MAX_NOTE_LENGTH}
              autoFocus
              accessibilityLabel="Note text"
            />
            <View style={styles.modalButtonRow}>
              <Pressable
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setNoteModalOpen(false);
                  setNoteText("");
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalSendButton]}
                onPress={handleSendNote}
                disabled={sendingNote || !noteText.trim()}
                accessibilityRole="button"
                accessibilityLabel="Send note"
              >
                {sendingNote ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.modalSendButtonText}>Send</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.cream },
  screen: { flex: 1, backgroundColor: colors.cream, padding: 16, gap: 16 },
  emptyText: { fontSize: 16, textAlign: "center", color: colors.textMuted },
  actionColumn: { gap: 12, marginTop: 8 },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.terracotta,
    borderRadius: 14,
    paddingVertical: 20,
    minHeight: 64,
  },
  actionButtonText: { color: colors.white, fontSize: 18, fontWeight: "700" },
  actionButtonDisabled: { backgroundColor: colors.sageLight, opacity: 0.7 },
  actionButtonTextDisabled: { color: colors.textMuted },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: colors.white, borderRadius: 16, padding: 20, width: "100%", gap: 14 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.navy },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    minHeight: 90,
    maxHeight: 160,
    textAlignVertical: "top",
    color: colors.text,
    backgroundColor: colors.cream,
  },
  modalButtonRow: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  modalButton: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, minWidth: 90, alignItems: "center" },
  modalCancelButton: { backgroundColor: colors.sageLight },
  modalCancelButtonText: { color: colors.navy, fontSize: 15, fontWeight: "600" },
  modalSendButton: { backgroundColor: colors.terracotta },
  modalSendButtonText: { color: colors.white, fontSize: 15, fontWeight: "700" },
});
