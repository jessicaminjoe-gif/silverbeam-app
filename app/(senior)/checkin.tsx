import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/state/useSession";
import { useCompanionSettings } from "@/hooks/useCompanionSettings";
import { colors } from "@/theme/colors";

export default function CheckInScreen() {
  const profile = useSession((s) => s.profile);
  const { settings, loading } = useCompanionSettings(profile?.id);
  const [submittingIndex, setSubmittingIndex] = useState<number | null>(null);

  async function handleSelect(index: number, label: string, emoji: string) {
    setSubmittingIndex(index);
    const { error } = await supabase.functions.invoke("submit-checkin", { body: { label, emoji } });
    setSubmittingIndex(null);
    if (error) {
      Alert.alert("Couldn't save", "Please try again.");
      return;
    }
    router.replace("/(senior)/home");
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.terracotta} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>How are you feeling today?</Text>
      <View style={styles.grid}>
        {settings.check_in_options.map((option, index) => (
          <Pressable
            key={option.label}
            style={styles.moodButton}
            onPress={() => handleSelect(index, option.label, option.emoji)}
            disabled={submittingIndex !== null}
            accessibilityRole="button"
            accessibilityLabel={option.label}
          >
            {submittingIndex === index ? (
              <ActivityIndicator size="large" color={colors.terracotta} />
            ) : (
              <>
                <Text style={styles.emoji}>{option.emoji}</Text>
                <Text style={styles.moodLabel}>{option.label}</Text>
              </>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 24, justifyContent: "center", backgroundColor: colors.cream },
  prompt: { fontSize: 26, fontWeight: "700", textAlign: "center", color: colors.navy },
  grid: { gap: 16 },
  moodButton: {
    minHeight: 90,
    borderRadius: 16,
    backgroundColor: colors.sageLight,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 16,
  },
  emoji: { fontSize: 40 },
  moodLabel: { fontSize: 22, fontWeight: "600", color: colors.navy },
});
