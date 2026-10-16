import { createElement, useEffect } from "react";
import { Platform, View } from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { isAllowedPlayerHost } from "@/lib/musicEmbed";

interface MusicPlayerProps {
  embedUrl: string;
}

function hostOf(url: string): string {
  return /^https?:\/\/([^/?#:]+)/i.exec(url)?.[1] ?? "";
}

// Plays a service's official embeddable player (YouTube / Spotify / Apple
// Music) inside the app, so the senior never leaves SilverBeam. Keeps the
// screen awake for as long as it's mounted -- unmounting it is also what
// stops the audio.
export function MusicPlayer({ embedUrl }: MusicPlayerProps) {
  // Native only, and failures are swallowed: browsers can refuse a wake lock,
  // and not keeping the screen on must never break playback.
  useEffect(() => {
    if (Platform.OS === "web") return;
    activateKeepAwakeAsync("music-player").catch(() => {});
    return () => {
      deactivateKeepAwake("music-player").catch(() => {});
    };
  }, []);

  if (Platform.OS === "web") {
    // react-native-webview doesn't run on web; an iframe lets the embeds be
    // checked in the dev preview.
    return (
      <View style={{ flex: 1 }}>
        {createElement("iframe", {
          src: embedUrl,
          allow: "autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture",
          style: { border: 0, width: "100%", height: "100%" },
          title: "Music player",
        })}
      </View>
    );
  }

  // Required lazily so the web bundle never evaluates the native module.
  const { WebView } = require("react-native-webview") as typeof import("react-native-webview");

  return (
    <WebView
      source={{ uri: embedUrl }}
      style={{ flex: 1, backgroundColor: "#000" }}
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={["https://*"]}
      // Only the music services' own pages may load; an ad or redirect
      // can't take the senior somewhere else.
      onShouldStartLoadWithRequest={(request) => request.url.startsWith("https://") && isAllowedPlayerHost(hostOf(request.url))}
    />
  );
}
