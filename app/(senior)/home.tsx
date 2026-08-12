import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCompanionChat } from "@/hooks/useCompanionChat";
import { useCompanionSettings } from "@/hooks/useCompanionSettings";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useSession } from "@/state/useSession";
import { colors } from "@/theme/colors";

export default function SeniorHomeScreen() {
  const insets = useSafeAreaInsets();
  const profile = useSession((s) => s.profile);
  const { messages, sendMessage, sending, loadingHistory, replay } = useCompanionChat();
  const { settings } = useCompanionSettings(profile?.id);
  const voice = useVoiceInput();
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList>(null);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage(text);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }

  // Fills the message box with what it heard rather than sending straight
  // away — gives the senior a chance to see (and fix, or just re-record)
  // what was transcribed before it actually sends, which matters more here
  // than for typing since speech recognition can mishear things.
  async function handleMicPress() {
    if (voice.state === "idle") {
      await voice.startRecording();
    } else if (voice.state === "recording") {
      const text = await voice.stopRecording();
      if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>
          <Text style={styles.titleSilver}>Silver</Text>
          <Text style={styles.titleBeam}>Beam</Text>
        </Text>
        <Pressable
          style={styles.callButton}
          onPress={() => router.push("/(senior)/call-picker")}
          accessibilityRole="button"
          accessibilityLabel="Let's Connect. Tap to video call."
        >
          <Ionicons name="videocam" size={30} color={colors.white} />
          <View>
            <Text style={styles.callButtonText}>Let's Connect</Text>
            <Text style={styles.callButtonSubtext}>Tap to video call</Text>
          </View>
        </Pressable>
      </View>

      {loadingHistory ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === "senior" ? styles.bubbleSenior : styles.bubbleAssistant]}>
              <Text style={styles.bubbleText}>{item.content}</Text>
              {item.role === "assistant" && (
                <Pressable
                  style={styles.replayButton}
                  onPress={() => replay(item.content)}
                  accessibilityRole="button"
                  accessibilityLabel="Play this reply out loud again"
                  hitSlop={8}
                >
                  <Ionicons name="volume-high" size={20} color={colors.navy} />
                </Pressable>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Say hello! Your {settings.companion_name} companion is here to chat.</Text>
          }
        />
      )}

      <View style={styles.inputRow}>
        <Pressable
          style={styles.checkinButton}
          onPress={() => router.push("/(senior)/checkin")}
          accessibilityRole="button"
          accessibilityLabel="Daily Check In"
        >
          <Text style={styles.checkinButtonText}>Check In</Text>
        </Pressable>
        <Pressable
          style={[styles.micButton, voice.state === "recording" && styles.micButtonRecording]}
          onPress={handleMicPress}
          disabled={voice.state === "transcribing"}
          accessibilityRole="button"
          accessibilityLabel={voice.state === "recording" ? "Stop recording" : "Speak your message"}
        >
          {voice.state === "transcribing" ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Ionicons name={voice.state === "recording" ? "stop" : "mic"} size={26} color={colors.white} />
          )}
        </Pressable>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={voice.state === "recording" ? "Listening..." : "Type or tap the mic to speak..."}
          multiline
          accessibilityLabel="Message"
        />
        <Pressable
          style={styles.sendButton}
          onPress={handleSend}
          disabled={sending || !input.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          {sending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.sendButtonText}>Send</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cream,
    gap: 12,
  },
  title: { fontSize: 28, fontWeight: "700" },
  titleSilver: { color: colors.navy },
  titleBeam: { color: colors.terracotta },
  callButton: {
    backgroundColor: colors.terracotta,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    minHeight: 60,
  },
  callButtonText: { color: colors.white, fontSize: 20, fontWeight: "700" },
  callButtonSubtext: { color: colors.white, fontSize: 14, opacity: 0.85, marginTop: 2 },
  list: { padding: 16, gap: 10, flexGrow: 1, backgroundColor: colors.cream },
  emptyText: { fontSize: 20, textAlign: "center", marginTop: 40, color: colors.textMuted },
  bubble: { borderRadius: 14, padding: 14, maxWidth: "85%" },
  bubbleSenior: { backgroundColor: colors.peach, alignSelf: "flex-end" },
  bubbleAssistant: { backgroundColor: colors.sageLight, alignSelf: "flex-start", paddingRight: 44 },
  bubbleText: { fontSize: 20, lineHeight: 28, color: colors.text },
  replayButton: { position: "absolute", right: 10, bottom: 10 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.cream,
  },
  checkinButton: {
    backgroundColor: colors.sageLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    minHeight: 60,
  },
  checkinButtonText: { fontSize: 16, fontWeight: "600", color: colors.navy },
  micButton: {
    backgroundColor: colors.navy,
    borderRadius: 30,
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonRecording: { backgroundColor: colors.danger },
  input: {
    flex: 1,
    fontSize: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 60,
    maxHeight: 120,
    color: colors.text,
    backgroundColor: colors.white,
  },
  sendButton: {
    backgroundColor: colors.terracotta,
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: "center",
    minHeight: 60,
  },
  sendButtonText: { color: colors.white, fontSize: 18, fontWeight: "700" },
});
