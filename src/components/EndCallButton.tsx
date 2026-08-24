import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";

// The one, consistent way to hang up on every call screen (senior and
// family, answering or calling out) -- previously the senior side relied
// on a CSS-boosted version of Daily's own in-page Leave button while
// family had this app-level button, which read as inconsistent between
// the two sides. Same red circle + phone icon everywhere now.
export function EndCallButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress} accessibilityRole="button" accessibilityLabel="End call">
      <Ionicons name="call" size={26} color={colors.white} style={styles.icon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    backgroundColor: colors.danger,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { transform: [{ rotate: "135deg" }] },
});
