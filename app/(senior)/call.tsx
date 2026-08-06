import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Pressable, PermissionsAndroid, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";

interface CreateCallResponse {
  roomUrl: string;
}

export default function CallScreen() {
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function start() {
      if (Platform.OS === "android") {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
      }
      const { data, error: fnError } = await supabase.functions.invoke<CreateCallResponse>("create-call", {
        body: {},
      });
      if (!mounted) return;
      if (fnError || !data?.roomUrl) {
        setError("Could not start the call. Please try again.");
        return;
      }
      setRoomUrl(data.roomUrl);
    }

    start();
    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!roomUrl) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.terracotta} />
        <Text style={styles.loadingText}>Starting your call...</Text>
      </View>
    );
  }

  return (
    <WebView
      source={{ uri: roomUrl }}
      style={{ flex: 1 }}
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={["*"]}
      mediaCapturePermissionGrantType="grant"
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.cream },
  loadingText: { fontSize: 20, color: colors.navy },
  errorText: { fontSize: 20, textAlign: "center", color: colors.danger },
  backButton: { backgroundColor: colors.terracotta, borderRadius: 10, paddingVertical: 16, paddingHorizontal: 24 },
  backButtonText: { color: colors.white, fontSize: 18, fontWeight: "600" },
});
