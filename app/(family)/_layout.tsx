import { Tabs } from "expo-router";

export default function FamilyLayout() {
  return (
    <Tabs screenOptions={{ headerTitleStyle: { fontWeight: "700" } }}>
      <Tabs.Screen name="dashboard" options={{ title: "Updates" }} />
      <Tabs.Screen name="senior-profile" options={{ title: "History" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
      {/* Reachable via router.push, intentionally hidden from the tab bar */}
      <Tabs.Screen name="escalation-detail" options={{ href: null, title: "Alert" }} />
    </Tabs>
  );
}
