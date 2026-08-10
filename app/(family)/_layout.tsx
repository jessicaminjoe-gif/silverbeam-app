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
        options={{ title: "Updates", tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }}
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
      <Tabs.Screen name="call" options={{ href: null, title: "Video Call" }} />
    </Tabs>
  );
}
