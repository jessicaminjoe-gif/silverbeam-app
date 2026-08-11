import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/state/useSession";
import { colors } from "@/theme/colors";

// Family-member self-signup only. Seniors are provisioned directly by the
// founder for the beta (see migration comment on profiles RLS) — after a
// family member creates an account here, the founder links them to their
// senior via senior_family_links (SQL/dashboard) before they'll see any data.
export default function SignupScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignup() {
    setError(null);
    if (!fullName.trim()) {
      setError("Please enter your name.");
      return;
    }
    setSubmitting(true);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });

    let session = signUpData.session;
    if (signUpError) {
      // "Already registered" on a retry almost always means a previous
      // attempt created the auth user but died before the profile insert
      // below ran (network blip, etc) -- signing up again can never
      // succeed at that point since the email is taken. Sign in instead
      // so the upsert below can finish what the first attempt started,
      // rather than leaving the account permanently stuck.
      if (!signUpError.message.toLowerCase().includes("already registered")) {
        setSubmitting(false);
        setError(signUpError.message);
        return;
      }
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !signInData.session) {
        setSubmitting(false);
        setError("An account with this email already exists. Check your password, or contact the SilverBeam team.");
        return;
      }
      session = signInData.session;
    }

    if (!session) {
      setSubmitting(false);
      setError("Could not create account.");
      return;
    }

    // Upsert, not insert: makes this step safely retryable (including the
    // sign-in-instead path above landing here with a profile that may or
    // may not already exist).
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: session.user.id, role: "family", full_name: fullName.trim() })
      .select()
      .single();
    setSubmitting(false);
    if (profileError || !profile) {
      setError(profileError?.message ?? "Could not create profile.");
      return;
    }
    // Set the profile directly rather than waiting on the root layout's
    // auth-state listener to (re)fetch it — that listener's own fetch fires
    // concurrently with this insert and can lose the race, leaving the app
    // stuck on this screen with no automatic redirect. Setting it here is
    // deterministic; the root layout's routing effect reacts to this same
    // state and redirects to (family)/dashboard on its own, no manual
    // navigation call needed (an earlier version called router.replace()
    // here too, which raced the same effect and crashed).
    useSession.getState().setProfile(profile);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.subtitle}>For family members staying connected through SilverBeam</Text>

      <TextInput
        style={styles.input}
        placeholder="Your full name"
        placeholderTextColor={colors.textMuted}
        value={fullName}
        onChangeText={setFullName}
        accessibilityLabel="Full name"
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        accessibilityLabel="Email"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        accessibilityLabel="Password"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={handleSignup} disabled={submitting} accessibilityRole="button">
        {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Create Account</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: colors.cream },
  title: { fontSize: 28, fontWeight: "700", textAlign: "center", color: colors.navy },
  subtitle: { fontSize: 15, textAlign: "center", marginBottom: 24, color: colors.textMuted },
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
});
