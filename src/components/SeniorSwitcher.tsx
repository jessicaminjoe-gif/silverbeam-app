import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import type { LinkedSenior } from "@/hooks/useLinkedSeniors";

interface Props {
  activeSenior: LinkedSenior | null;
  seniors: LinkedSenior[];
  onSwitch: (seniorId: string) => void;
}

// Plain Alert.alert as the picker rather than a custom dropdown/modal --
// this is a beta-scale list (a handful of linked seniors at most), and
// Alert gets full accessibility support for free.
export function SeniorSwitcher({ activeSenior, seniors, onSwitch }: Props) {
  const canSwitch = seniors.length > 1;

  function handlePress() {
    if (!canSwitch) return;
    Alert.alert(
      "Switch senior",
      undefined,
      [
        ...seniors.map((s) => ({ text: s.fullName, onPress: () => onSwitch(s.seniorId) })),
        { text: "Cancel", style: "cancel" as const },
      ]
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={!canSwitch}
      style={styles.container}
      accessibilityRole={canSwitch ? "button" : undefined}
      accessibilityLabel={canSwitch ? "Switch which senior you're viewing" : undefined}
    >
      <Text style={styles.text}>{activeSenior?.fullName ?? "No one linked"}</Text>
      {canSwitch && <Ionicons name="chevron-down" size={18} color={colors.navy} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 4 },
  text: { fontSize: 24, fontWeight: "700", color: colors.navy },
});
