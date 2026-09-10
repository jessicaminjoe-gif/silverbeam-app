import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { redeemInvite } from "@/lib/familyInvites";
import { colors } from "@/theme/colors";

interface Props {
  // Called after a successful redemption so the caller can refetch its
  // linked-seniors list (e.g. useLinkedSeniors's reload) and show the
  // newly-connected senior instead of this form.
  onConnected: () => void;
}

// Shown wherever a family account isn't linked to a senior yet (Home,
// Updates, History empty states) -- the self-serve counterpart to
// create-invite in SeniorContactSettings.tsx.
export function RedeemInviteForm({ onConnected }: Props) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!code.trim()) return;
    setSubmitting(true);
    try {
      const result = await redeemInvite(code.trim());
      setCode("");
      Alert.alert("Connected!", `You're now connected to ${result.seniorFullName}.`);
      onConnected();
    } catch (err) {
      Alert.alert("Couldn't connect", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Have an invite code?</Text>
      <Text style={styles.hint}>Ask the family member who set up SilverBeam to send you a code.</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        placeholder="Enter code"
        autoCapitalize="characters"
        maxLength={6}
        accessibilityLabel="Invite code"
      />
      <Pressable
        style={styles.button}
        onPress={handleSubmit}
        disabled={submitting || !code.trim()}
        accessibilityRole="button"
        accessibilityLabel="Connect with invite code"
      >
        {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Connect</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 14, padding: 20, gap: 12, width: "100%" },
  title: { fontSize: 17, fontWeight: "700", color: colors.navy, textAlign: "center" },
  hint: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    letterSpacing: 3,
    textAlign: "center",
    color: colors.text,
    backgroundColor: colors.cream,
  },
  button: { backgroundColor: colors.terracotta, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
});
