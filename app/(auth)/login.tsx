import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Image, Platform } from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";

// expo export --platform web doesn't resolve local require()'d image
// sources correctly in the static bundle (works fine in the dev server,
// breaks only in the exported build) — using the public/ folder's absolute
// path sidesteps it for web, while native keeps using the real asset via
// require() like normal.
const logoSource = Platform.OS === "web" ? { uri: "/brand-icon.png" } : require("../../assets/icon.png");

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) setError(signInError.message);
    // On success, the root layout's auth listener handles routing.
  }

  return (
    <View style={styles.container}>
      <Image source={logoSource} style={styles.logo} accessibilityLabel="SilverBeam" />
      <Text style={styles.title}>
        <Text style={styles.titleSilver}>Silver</Text>
        <Text style={styles.titleBeam}>Beam</Text>
      </Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

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

      <Pressable style={styles.button} onPress={handleLogin} disabled={submitting} accessibilityRole="button">
        {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Sign In</Text>}
      </Pressable>

      <Link href="/(auth)/signup" style={styles.link}>
        Family member? Create an account
      </Link>
      <Link href="/(auth)/setup-senior-device" style={styles.link}>
        Setting up a device for a senior? Tap here
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: colors.cream },
  logo: { width: 84, height: 84, alignSelf: "center", marginBottom: 4 },
  title: { fontSize: 32, fontFamily: "PlayfairDisplay_700Bold", textAlign: "center" },
  titleSilver: { color: colors.navy },
  titleBeam: { color: colors.terracotta },
  subtitle: { fontSize: 16, textAlign: "center", marginBottom: 24, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
  button: {
    backgroundColor: colors.terracotta,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: colors.white, fontSize: 18, fontWeight: "600" },
  error: { color: colors.danger, textAlign: "center" },
  link: { textAlign: "center", marginTop: 16, color: colors.terracotta },
});
