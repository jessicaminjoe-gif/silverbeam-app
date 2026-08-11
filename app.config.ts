import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "SilverBeam",
  slug: "silverbeam-app",
  owner: "silverbeam",
  scheme: "silverbeam",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#FFFDFB",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.silverbeam.app",
    infoPlist: {
      NSCameraUsageDescription: "SilverBeam uses your camera for video calls with family.",
      NSMicrophoneUsageDescription: "SilverBeam uses your microphone for video calls with family.",
      NSPhotoLibraryUsageDescription: "SilverBeam uses your photo library to set your profile picture.",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#FFFDFB",
    },
    package: "com.silverbeam.app",
    permissions: ["CAMERA", "RECORD_AUDIO"],
    googleServicesFile: "./google-services.json",
  },
  plugins: [
    "expo-router",
    "expo-dev-client",
    "expo-notifications",
    [
      "expo-image-picker",
      { photosPermission: "SilverBeam uses your photo library to set your profile picture." },
    ],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      // From `eas init` — required for push notifications to resolve a
      // project-scoped Expo push token. Not a secret, safe to commit.
      projectId: "8a201d80-41b0-4087-b927-dcdb99e918b6",
    },
  },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
