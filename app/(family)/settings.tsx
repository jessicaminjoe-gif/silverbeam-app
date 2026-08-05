import { View, Text, Pressable, StyleSheet, FlatList } from "react-native";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/state/useSession";
import { useLinkedSeniors } from "@/hooks/useLinkedSeniors";

export default function SettingsScreen() {
  const profile = useSession((s) => s.profile);
  const { seniors, loading } = useLinkedSeniors();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{profile?.full_name}</Text>
      <Text style={styles.subheading}>Linked family members</Text>

      {!loading && (
        <FlatList
          data={seniors}
          keyExtractor={(item) => item.seniorId}
          renderItem={({ item }) => (
            <View style={styles.seniorRow}>
              <Text style={styles.seniorName}>{item.fullName}</Text>
              {item.isEmergencyContact && <Text style={styles.badge}>Emergency contact</Text>}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Not linked to anyone yet. Contact the SilverBeam team to get connected to your family member's
              account.
            </Text>
          }
        />
      )}

      <Pressable style={styles.signOutButton} onPress={() => supabase.auth.signOut()} accessibilityRole="button">
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16 },
  heading: { fontSize: 24, fontWeight: "700" },
  subheading: { fontSize: 16, fontWeight: "600", color: "#555", marginTop: 8 },
  seniorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f7f7f7",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  seniorName: { fontSize: 16, fontWeight: "500" },
  badge: { fontSize: 12, color: "#2d6a4f", fontWeight: "700" },
  emptyText: { fontSize: 15, color: "#555" },
  signOutButton: {
    marginTop: "auto",
    backgroundColor: "#b00020",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  signOutText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
