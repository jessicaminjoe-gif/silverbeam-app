import { Stack } from "expo-router";
import { colors } from "@/theme/colors";

// Plain stack, no tabs, one level deep from Home for most flows — per the
// accessibility baseline (avoid nav complexity for the senior-facing
// experience). Calling is the one exception: with more than one linked
// family member, home -> call-picker -> call is two levels, but
// call-picker auto-skips straight to call when there's only one contact,
// which covers most beta families.
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
      <Stack.Screen name="call-picker" options={{ title: "Let's Connect" }} />
      <Stack.Screen name="call" options={{ title: "Video Call" }} />
      <Stack.Screen name="incoming-call" options={{ title: "Incoming Call", headerShown: false }} />
      <Stack.Screen name="photos" options={{ title: "Photos from Family" }} />
    </Stack>
  );
}
