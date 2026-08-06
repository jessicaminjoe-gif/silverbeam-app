import { Stack } from "expo-router";
import { colors } from "@/theme/colors";

// Plain stack, no tabs, one level deep from Home — per the accessibility
// baseline (avoid nav complexity for the senior-facing experience).
export default function SeniorLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleStyle: { fontSize: 22, fontWeight: "700", color: colors.navy },
        headerStyle: { backgroundColor: colors.cream },
        headerTintColor: colors.terracotta,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen name="home" options={{ title: "SilverBeam", headerShown: false }} />
      <Stack.Screen name="checkin" options={{ title: "Check In" }} />
      <Stack.Screen name="call" options={{ title: "Video Call" }} />
    </Stack>
  );
}
