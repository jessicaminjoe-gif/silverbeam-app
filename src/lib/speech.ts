import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { supabase } from "@/lib/supabase";

interface SynthesizeSpeechResponse {
  audioBase64: string;
}

export interface SpeakResult {
  ok: boolean;
  errorMessage?: string;
}

let currentSound: Audio.Sound | null = null;
let audioModeReady = false;

async function ensureAudioMode() {
  if (audioModeReady) return;
  // Companion replies should still be audible with the ringer switched
  // off — a silenced phone is the normal state for a lot of seniors, and
  // this isn't a notification, it's the thing they just asked for.
  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  audioModeReady = true;
}

// Fetches TTS audio for `text` and plays it immediately, stopping whatever
// was playing before. Returns whether it actually worked — callers that
// don't care (e.g. the auto-play-after-reply path, where losing the audio
// isn't worth alarming a senior over) can just ignore the result; the
// Settings voice-preview button surfaces it via SpeakResult.errorMessage
// so failures are diagnosable instead of just "the speaker icon did
// nothing."
export async function speak(text: string, voiceId?: string): Promise<SpeakResult> {
  try {
    await ensureAudioMode();
    const { data, error } = await supabase.functions.invoke<SynthesizeSpeechResponse>("synthesize-speech", {
      body: { text, voiceId },
    });
    if (error || !data?.audioBase64) {
      const message = error?.message ?? "No audio returned";
      console.error("[speech] synthesize-speech failed:", message);
      return { ok: false, errorMessage: message };
    }

    const fileUri = `${FileSystem.cacheDirectory}silverbeam-speech-${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(fileUri, data.audioBase64, { encoding: FileSystem.EncodingType.Base64 });

    if (currentSound) {
      await currentSound.unloadAsync().catch(() => {});
      currentSound = null;
    }
    const { sound } = await Audio.Sound.createAsync({ uri: fileUri }, { shouldPlay: true });
    currentSound = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (currentSound === sound) currentSound = null;
      }
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[speech] playback failed:", message);
    return { ok: false, errorMessage: message };
  }
}

export async function stopSpeaking(): Promise<void> {
  if (!currentSound) return;
  await currentSound.unloadAsync().catch(() => {});
  currentSound = null;
}
