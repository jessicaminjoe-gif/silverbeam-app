import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/state/useSession";

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
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError || !data.user) {
      setSubmitting(false);
      setError(signUpError?.message ?? "Could not create account.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({ id: data.user.id, role: "family", full_name: fullName.trim() })
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
        value={fullName}
        onChangeText={setFullName}
        accessibilityLabel="Full name"
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        accessibilityLabel="Email"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        accessibilityLabel="Password"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={handleSignup} disabled={submitting} accessibilityRole="button">
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 15, textAlign: "center", marginBottom: 24, color: "#555" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 14, fontSize: 16 },
  button: { backgroundColor: "#2d6a4f", borderRadius: 8, padding: 16, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  error: { color: "#b00020", textAlign: "center" },
});
