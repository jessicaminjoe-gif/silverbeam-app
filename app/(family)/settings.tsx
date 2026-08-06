import { View, Text, Pressable, StyleSheet, FlatList } from "react-native";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/state/useSession";
import { useLinkedSeniors } from "@/hooks/useLinkedSeniors";
import { colors } from "@/theme/colors";

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
  container: { flex: 1, padding: 24, gap: 16, backgroundColor: colors.cream },
  heading: { fontSize: 24, fontWeight: "700", color: colors.navy },
  subheading: { fontSize: 16, fontWeight: "600", color: colors.textMuted, marginTop: 8 },
  seniorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  seniorName: { fontSize: 16, fontWeight: "500", color: colors.text },
  badge: { fontSize: 12, color: "#5F7355", fontWeight: "700" },
  emptyText: { fontSize: 15, color: colors.textMuted },
  signOutButton: {
    marginTop: "auto",
    backgroundColor: colors.navy,
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  signOutText: { color: colors.white, fontSize: 16, fontWeight: "600" },
});
