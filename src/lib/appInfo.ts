import Constants from "expo-constants";
import { Platform } from "react-native";

export const SUPPORT_EMAIL = "admin@silverbeam.io";
export const PRIVACY_URL = "https://silverbeam.io/privacy";
export const TERMS_URL = "https://silverbeam.io/terms";

export const APP_VERSION = Constants.expoConfig?.version ?? "unknown";

// mailto: link for the "Send feedback" row. The subject and footer carry the
// details support needs to reproduce a problem (no personal data).
export function feedbackMailto(): string {
  const subject = encodeURIComponent(`SilverBeam feedback (v${APP_VERSION}, ${Platform.OS})`);
  const body = encodeURIComponent(
    "Tell us what happened or what you'd like to see:\n\n\n\n---\nApp version: " +
      `${APP_VERSION}\nDevice: ${Platform.OS} ${Platform.Version}`
  );
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}
