import { useState } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Pressable, Alert, Modal } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useActiveSenior } from "@/hooks/useActiveSenior";
import { useCompanionSettings } from "@/hooks/useCompanionSettings";
import { useVoiceNoteRecorder } from "@/hooks/useVoiceNoteRecorder";
import { SeniorSwitcher } from "@/components/SeniorSwitcher";
import { RedeemInviteForm } from "@/components/RedeemInviteForm";
import { pickAndSharePhoto } from "@/lib/uploadPhoto";
import { sendNoteToSenior, sendVoiceNoteToSenior } from "@/lib/sendNote";
import { colors } from "@/theme/colors";

const MAX_NOTE_LENGTH = 500;

// Home: the three things family does most -- call, send a photo, send a
// note. Check-ins and alerts moved to their own Updates tab (updates.tsx)
// so this stays a quick action screen, not a feed to scroll through.
export default function DashboardScreen() {
  const { activeSenior, seniors, loading: loadingSeniors, setActiveSeniorId, reload } = useActiveSenior();
  const { settings } = useCompanionSettings(activeSenior?.seniorId);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [sendingNote, setSendingNote] = useState(false);
  const recorder = useVoiceNoteRecorder();

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

  function closeNoteModal() {
    setNoteModalOpen(false);
    setNoteText("");
    recorder.reset();
  }

  async function handleSendNote() {
    if (!activeSenior || !noteText.trim()) return;
    setSendingNote(true);
    try {
      await sendNoteToSenior(activeSenior.seniorId, noteText.trim());
      closeNoteModal();
      Alert.alert("Sent!", `${activeSenior.fullName} will be notified.`);
    } catch (err) {
      Alert.alert("Couldn't send note", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSendingNote(false);
    }
  }

  async function handleSendVoiceNote() {
    if (!activeSenior || !recorder.uri) return;
    setSendingNote(true);
    try {
      const transcript = await sendVoiceNoteToSenior(activeSenior.seniorId, recorder.uri);
      closeNoteModal();
      Alert.alert("Sent!", `${activeSenior.fullName} will be notified. Heard: "${transcript}"`);
    } catch (err) {
      Alert.alert("Couldn't send voice note", err instanceof Error ? err.message : "Please try again.");
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
        <RedeemInviteForm onConnected={reload} />
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

      <Modal visible={noteModalOpen} transparent animationType="fade" onRequestClose={closeNoteModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Send {activeSenior?.fullName} a note</Text>

            {recorder.state === "recorded" ? (
              <>
                <Text style={styles.voiceNoteReadyText}>Voice note ready to send</Text>
                <View style={styles.modalButtonRow}>
                  <Pressable style={[styles.modalButton, styles.modalCancelButton]} onPress={recorder.playPreview} accessibilityRole="button" accessibilityLabel="Play back recording">
                    <Ionicons name="play" size={16} color={colors.navy} />
                    <Text style={styles.modalCancelButtonText}>Play</Text>
                  </Pressable>
                  <Pressable style={[styles.modalButton, styles.modalCancelButton]} onPress={recorder.reset} accessibilityRole="button" accessibilityLabel="Re-record">
                    <Text style={styles.modalCancelButtonText}>Re-record</Text>
                  </Pressable>
                </View>
                <View style={styles.modalButtonRow}>
                  <Pressable style={[styles.modalButton, styles.modalCancelButton]} onPress={closeNoteModal} accessibilityRole="button" accessibilityLabel="Cancel">
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, styles.modalSendButton]}
                    onPress={handleSendVoiceNote}
                    disabled={sendingNote}
                    accessibilityRole="button"
                    accessibilityLabel="Send voice note"
                  >
                    {sendingNote ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.modalSendButtonText}>Send</Text>}
                  </Pressable>
                </View>
              </>
            ) : recorder.state === "recording" ? (
              <>
                <View style={styles.recordingRow}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.voiceNoteReadyText}>Recording...</Text>
                </View>
                <Pressable style={[styles.modalButton, styles.modalSendButton]} onPress={recorder.stopRecording} accessibilityRole="button" accessibilityLabel="Stop recording">
                  <Ionicons name="stop" size={18} color={colors.white} />
                  <Text style={styles.modalSendButtonText}>Stop</Text>
                </Pressable>
              </>
            ) : (
              <>
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
                <Pressable
                  style={styles.recordButton}
                  onPress={recorder.startRecording}
                  accessibilityRole="button"
                  accessibilityLabel="Record a voice note instead"
                >
                  <Ionicons name="mic" size={18} color={colors.terracotta} />
                  <Text style={styles.recordButtonText}>Or record a voice note</Text>
                </Pressable>
                <View style={styles.modalButtonRow}>
                  <Pressable style={[styles.modalButton, styles.modalCancelButton]} onPress={closeNoteModal} accessibilityRole="button" accessibilityLabel="Cancel">
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
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.cream },
  screen: { flex: 1, backgroundColor: colors.cream, padding: 16, gap: 16 },
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
  modalButton: {
    flexDirection: "row",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelButton: { backgroundColor: colors.sageLight },
  modalCancelButtonText: { color: colors.navy, fontSize: 15, fontWeight: "600" },
  modalSendButton: { backgroundColor: colors.terracotta },
  modalSendButtonText: { color: colors.white, fontSize: 15, fontWeight: "700" },
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.terracotta,
    borderRadius: 10,
    paddingVertical: 10,
  },
  recordButtonText: { color: colors.terracotta, fontSize: 14, fontWeight: "700" },
  voiceNoteReadyText: { fontSize: 16, color: colors.text, textAlign: "center" },
  recordingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 8 },
  recordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger },
});
