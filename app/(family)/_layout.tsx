import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";

export default function FamilyLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitleStyle: { fontWeight: "700", color: colors.navy },
        headerStyle: { backgroundColor: colors.cream },
        tabBarActiveTintColor: colors.terracotta,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.cream, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="updates"
        options={{ title: "Updates", tabBarIcon: ({ color, size }) => <Ionicons name="notifications" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="senior-profile"
        options={{ title: "History", tabBarIcon: ({ color, size }) => <Ionicons name="time" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} /> }}
      />
      {/* Reachable via router.push, intentionally hidden from the tab bar */}
      <Tabs.Screen name="escalation-detail" options={{ href: null, title: "Alert" }} />
      {/* unmountOnBlur: a tab screen normally stays mounted (and keeps its
          state) even after you navigate away — fine for Dashboard/History,
          but these two create/join a specific call and need a truly fresh
          start every time, not the previous call's now-dead room still
          sitting in state. Without this, calling the same senior twice in
          a row silently reused the first call's (expired) room. */}
      <Tabs.Screen name="call" options={{ href: null, title: "Video Call", unmountOnBlur: true }} />
      <Tabs.Screen name="call-outbound" options={{ href: null, title: "Video Call", unmountOnBlur: true }} />
    </Tabs>
  );
}
