import { useEffect, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";
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
