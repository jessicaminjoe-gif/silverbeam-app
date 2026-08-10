import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { colors } from "@/theme/colors";
import { CallWebView } from "@/components/CallWebView";

// Reached by tapping the "is calling" push notification (see the
// notification-response handler in app/_layout.tsx) or directly if the
// dashboard ever grows a "join call" affordance. roomUrl comes straight
// from the notification's data payload — this screen doesn't create a
// room itself, only the senior's "Call Family" button does that.
export default function FamilyCallScreen() {
  const { roomUrl } = useLocalSearchParams<{ roomUrl: string }>();

  if (!roomUrl) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No call to join right now.</Text>
      </View>
    );
  }

  return <CallWebView roomUrl={roomUrl} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.cream },
  errorText: { fontSize: 18, color: colors.textMuted, textAlign: "center" },
});
