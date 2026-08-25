import { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCompanionChat } from "@/hooks/useCompanionChat";
import { useCompanionSettings } from "@/hooks/useCompanionSettings";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useSession } from "@/state/useSession";
import { colors } from "@/theme/colors";

// The AI companion's own space, reached from Home's "Chat" button rather
// than being the first thing the senior sees -- see home.tsx for the
// family-feed-first layout this was split out of.
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const profile = useSession((s) => s.profile);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const { messages, sendMessage, sending, loadingHistory, replay } = useCompanionChat(soundEnabled);
  const { settings } = useCompanionSettings(profile?.id);
  const voice = useVoiceInput();
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList>(null);
  const seniorDisplayName = settings.senior_nickname || profile?.full_name || "there";

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
      const result = await voice.stopRecording();
      if (result.text) {
        setInput((prev) => (prev ? `${prev} ${result.text}` : result.text ?? ""));
      } else {
        // Friendly wording for the senior; the real error is already
        // logged in the hook for us to diagnose separately.
        Alert.alert("Sorry, I didn't catch that", "Please try again.");
      }
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color={colors.navy} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {settings.companion_name}
        </Text>
        <Pressable
          style={styles.soundButton}
          onPress={() => setSoundEnabled((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel={soundEnabled ? "Turn off spoken replies" : "Turn on spoken replies"}
          hitSlop={8}
        >
          <Ionicons name={soundEnabled ? "volume-high" : "volume-mute"} size={26} color={colors.navy} />
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
            <Text style={styles.emptyText}>
              Hi {seniorDisplayName}! {settings.companion_name} is here to chat any time.
            </Text>
          }
        />
      )}

      <View style={styles.inputRow}>
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
            <Ionicons name={voice.state === "recording" ? "stop" : "mic"} size={34} color={colors.white} />
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cream,
  },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: "700", color: colors.navy },
  soundButton: { width: 40, alignItems: "center" },
  list: { padding: 16, gap: 10, flexGrow: 1, backgroundColor: colors.cream },
  emptyText: { fontSize: 26, fontWeight: "600", textAlign: "center", marginTop: 40, lineHeight: 34, color: colors.navy, paddingHorizontal: 12 },
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
  micButton: {
    backgroundColor: colors.navy,
    borderRadius: 38,
    width: 76,
    height: 76,
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
