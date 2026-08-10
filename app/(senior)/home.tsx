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
import { colors } from "@/theme/colors";

// Note on voice input: the device keyboard's built-in dictation mic (iOS
// and Android both provide one on any text field) lets a senior speak
// instead of type with zero extra library work. A dedicated in-app
// speech-to-text button is a Phase 2+ stretch goal, not required for beta.
export default function SeniorHomeScreen() {
  const insets = useSafeAreaInsets();
  const { messages, sendMessage, sending, loadingHistory } = useCompanionChat();
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList>(null);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage(text);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
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
          onPress={() => router.push("/(senior)/call")}
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
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Say hello! Your SilverBeam companion is here to chat.</Text>
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
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type or dictate a message..."
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
  bubbleAssistant: { backgroundColor: colors.sageLight, alignSelf: "flex-start" },
  bubbleText: { fontSize: 20, lineHeight: 28, color: colors.text },
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
