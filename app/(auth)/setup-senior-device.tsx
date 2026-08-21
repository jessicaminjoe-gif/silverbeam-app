import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/state/useSession";
import { colors } from "@/theme/colors";
import type { Profile } from "@/types/database";

// Run through by a family member, in person, on the senior's own device —
// not by the senior. Creates an anonymous auth identity (no email or phone
// needed) so the device just stays signed in from here on. The founder
// still links this senior to a family account manually for the beta (see
// README) using the id shown after setup.
//
// Post-beta upgrade path (not built yet, but nothing here blocks it): call
// supabase.auth.updateUser({ email }) or { phone }) on this same senior
// session to attach a recoverable identity. The user id and all their data
// (check-ins, conversation history, escalation events) carry over
// unchanged — Supabase just flips auth.users.is_anonymous to false once
// confirmed.
export default function SetupSeniorDeviceScreen() {
  const [mode, setMode] = useState<"new" | "reconnect">("new");
  const [fullName, setFullName] = useState("");
  const [existingId, setExistingId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdProfile, setCreatedProfile] = useState<Profile | null>(null);

  async function handleSetup() {
    setError(null);
    if (!fullName.trim()) {
      setError("Please enter the senior's name.");
      return;
    }
    setSubmitting(true);
    const { data, error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError || !data.user) {
      setSubmitting(false);
      setError(signInError?.message ?? "Could not set up this device.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({ id: data.user.id, role: "senior", full_name: fullName.trim() })
      .select()
      .single();
    setSubmitting(false);
    if (profileError || !profile) {
      setError(profileError?.message ?? "Could not create profile.");
      return;
    }

    // The root layout's own auth listener has almost certainly already
    // loaded this same profile into global state by now (it reacts to the
    // signInAnonymously() session independently of this insert), but its
    // auto-redirect is deliberately suppressed while on this screen — see
    // app/_layout.tsx. So the family member gets a chance to see and copy
    // the id below before we move on to the companion, via "Done".
    setCreatedProfile(profile as Profile);
  }

  // Reconnects this device to an already-existing senior account (e.g.
  // after a reinstall) instead of creating a new, unlinked one — the id is
  // visible to any linked family member in Settings.
  async function handleReconnect() {
    setError(null);
    const id = existingId.trim();
    if (!id) {
      setError("Please enter the senior ID from Family Settings.");
      return;
    }
    setSubmitting(true);
    const { data, error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError || !data.user) {
      setSubmitting(false);
      setError(signInError?.message ?? "Could not set up this device.");
      return;
    }

    const { data: result, error: claimError } = await supabase.functions.invoke<{ profile: Profile }>(
      "claim-senior-device",
      { body: { oldSeniorId: id } }
    );
    setSubmitting(false);
    if (claimError || !result?.profile) {
      setError("Couldn't find a senior account with that ID. Double-check it and try again.");
      return;
    }
    useSession.getState().setProfile(result.profile);
    router.replace("/(senior)/home");
  }

  function handleDone() {
    if (!createdProfile) return;
    useSession.getState().setProfile(createdProfile);
    router.replace("/(senior)/home");
  }

  if (createdProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Device is set up</Text>
        <Text style={styles.subtitle}>
          Share this ID with SilverBeam so {createdProfile.full_name} can be connected to family:
        </Text>
        <Text selectable style={styles.idText}>
          {createdProfile.id}
        </Text>
        <Pressable style={styles.button} onPress={handleDone} accessibilityRole="button">
          <Text style={styles.buttonText}>Done — Open Companion</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{mode === "new" ? "Set Up This Device" : "Reconnect This Device"}</Text>
      <Text style={styles.subtitle}>
        {mode === "new"
          ? "For a family member to fill out, in person, on the senior's own tablet or phone. No email or password needed for them."
          : "If this senior already has an account (e.g. the app was reinstalled), enter their ID from Family Settings to reconnect instead of starting over."}
      </Text>

      {mode === "new" ? (
        <TextInput
          style={styles.input}
          placeholder="Senior's full name"
          placeholderTextColor={colors.textMuted}
          value={fullName}
          onChangeText={setFullName}
          accessibilityLabel="Senior's full name"
        />
      ) : (
        <TextInput
          style={styles.input}
          placeholder="Senior ID"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          value={existingId}
          onChangeText={setExistingId}
          accessibilityLabel="Senior ID"
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={styles.button}
        onPress={mode === "new" ? handleSetup : handleReconnect}
        disabled={submitting}
        accessibilityRole="button"
      >
        {submitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>{mode === "new" ? "Set Up This Device" : "Reconnect"}</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => {
          setError(null);
          setMode(mode === "new" ? "reconnect" : "new");
        }}
        accessibilityRole="button"
      >
        <Text style={styles.link}>
          {mode === "new" ? "Already have a senior ID? Reconnect instead" : "Setting up for the first time instead?"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: colors.cream },
  title: { fontSize: 28, fontWeight: "700", textAlign: "center", color: colors.navy },
  subtitle: { fontSize: 15, textAlign: "center", marginBottom: 12, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
  button: { backgroundColor: colors.terracotta, borderRadius: 8, padding: 16, alignItems: "center", marginTop: 8 },
  buttonText: { color: colors.white, fontSize: 18, fontWeight: "600" },
  error: { color: colors.danger, textAlign: "center" },
  link: { textAlign: "center", marginTop: 16, color: colors.terracotta },
  idText: {
    fontSize: 16,
    fontFamily: "monospace",
    textAlign: "center",
    backgroundColor: colors.sageLight,
    padding: 12,
    borderRadius: 8,
    color: colors.navy,
  },
});
