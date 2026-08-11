import { useEffect, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewNavigation } from "react-native-webview";

const CALL_ENDED_SCHEME = "silverbeam://call-ended";

// Best-effort accessibility boost for the senior-facing call — Daily
// Prebuilt has no documented property for resizing individual tray
// buttons, so this targets the Leave button by its aria-label (more
// stable than guessing at internal class names, but still not an
// official API — if Daily changes their markup this silently no-ops
// rather than breaking anything).
const ACCESSIBLE_CONTROLS_CSS = `
(function() {
  var style = document.createElement('style');
  style.innerHTML = '[aria-label*="Leave" i] { transform: scale(1.5); } ' +
    '[aria-label*="Leave" i] svg { width: 32px !important; height: 32px !important; }';
  document.head.appendChild(style);
})();
true;
`;

interface CallWebViewProps {
  roomUrl: string;
  // Fires when the WebView tries to navigate to the app's custom-scheme
  // call-ended redirect (see create-call's redirect_on_meeting_exit) —
  // only meaningful when roomUrl carries a token configured with that
  // redirect, i.e. currently just the senior's outbound call.
  onCallEnded?: () => void;
  // Applies the leave-button CSS boost above. Senior-only by convention —
  // family's call screen doesn't opt in.
  accessibleControls?: boolean;
}

// Shared by both the senior's "Call Family" screen and the family's
// incoming-call screen — same Daily.co Prebuilt WebView, same Android
// camera/mic permission dance, different callers.
export function CallWebView({ roomUrl, onCallEnded, accessibleControls }: CallWebViewProps) {
  const [permissionsReady, setPermissionsReady] = useState(Platform.OS !== "android");

  useEffect(() => {
    if (Platform.OS !== "android") return;
    PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]).finally(() => setPermissionsReady(true));
  }, []);

  if (!permissionsReady) return null;

  function handleShouldStartLoad(request: WebViewNavigation): boolean {
    if (request.url.startsWith(CALL_ENDED_SCHEME)) {
      onCallEnded?.();
      return false;
    }
    return true;
  }

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
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        injectedJavaScript={accessibleControls ? ACCESSIBLE_CONTROLS_CSS : undefined}
      />
    </SafeAreaView>
  );
}
