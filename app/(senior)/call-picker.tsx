import { useEffect, useRef } from "react";
import { View, Text, Image, Pressable, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useCallContacts, type CallContact } from "@/hooks/useCallContacts";
import { colors } from "@/theme/colors";

export default function CallPickerScreen() {
  const { contacts, loading } = useCallContacts();
  const autoNavigated = useRef(false);

  // Skip the picker entirely when there's only one person to call — no
  // reason to make someone choose from a list of one.
  useEffect(() => {
    if (loading || autoNavigated.current) return;
    if (contacts.length === 1) {
      autoNavigated.current = true;
      router.replace({ pathname: "/(senior)/call", params: { familyMemberId: contacts[0].familyMemberId } });
    }
  }, [loading, contacts]);

  if (loading || contacts.length === 1) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.terracotta} />
      </View>
    );
  }

  if (contacts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No one is set up to call yet. Ask your family to get connected.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <Text style={styles.heading}>Who would you like to connect with?</Text>
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.familyMemberId}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => <ContactBubble contact={item} />}
      />
    </View>
  );
}

function ContactBubble({ contact }: { contact: CallContact }) {
  return (
    <Pressable
      style={styles.bubble}
      onPress={() => router.push({ pathname: "/(senior)/call", params: { familyMemberId: contact.familyMemberId } })}
      accessibilityRole="button"
      accessibilityLabel={`Call ${contact.fullName}${contact.relationship ? `, ${contact.relationship}` : ""}`}
    >
      {contact.avatarUrl ? (
        <Image source={{ uri: contact.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>{contact.fullName[0]?.toUpperCase() ?? "?"}</Text>
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>
        {contact.fullName}
      </Text>
      {contact.relationship && <Text style={styles.tag}>{contact.relationship}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.cream },
  emptyText: { fontSize: 20, textAlign: "center", color: colors.textMuted },
  heading: { fontSize: 22, fontWeight: "700", color: colors.navy, textAlign: "center", padding: 20 },
  grid: { padding: 12, gap: 16 },
  row: { gap: 16 },
  bubble: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 20,
    gap: 6,
    minHeight: 140,
  },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  avatarPlaceholder: { backgroundColor: colors.sageLight, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 32, fontWeight: "700", color: colors.navy },
  name: { fontSize: 18, fontWeight: "700", color: colors.text, maxWidth: "90%" },
  tag: { fontSize: 14, color: colors.textMuted },
});
