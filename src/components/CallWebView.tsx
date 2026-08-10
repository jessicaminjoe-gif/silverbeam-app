import { useEffect, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

// Shared by both the senior's "Call Family" screen and the family's
// incoming-call screen — same Daily.co Prebuilt WebView, same Android
// camera/mic permission dance, different callers.
export function CallWebView({ roomUrl }: { roomUrl: string }) {
  const [permissionsReady, setPermissionsReady] = useState(Platform.OS !== "android");

  useEffect(() => {
    if (Platform.OS !== "android") return;
    PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]).finally(() => setPermissionsReady(true));
  }, []);

  if (!permissionsReady) return null;

  return (
    // Daily's Prebuilt UI puts its call tray (including "Join") right at
    // the bottom of the page — on Android that landed underneath the
    // system gesture/nav bar since the WebView drew full-bleed. Insetting
    // for safe area keeps the tray above it.
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} edges={["top", "bottom"]}>
      <WebView
        source={{ uri: roomUrl }}
        style={{ flex: 1 }}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
        mediaCapturePermissionGrantType="grant"
        scalesPageToFit={false}
      />
    </SafeAreaView>
  );
}
