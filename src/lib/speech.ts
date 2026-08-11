import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { supabase } from "@/lib/supabase";

interface SynthesizeSpeechResponse {
  audioBase64: string;
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
// was playing before. Silently no-ops on failure — losing the spoken
// reply isn't worth surfacing an error over when the text reply already
// rendered fine.
export async function speak(text: string, voiceId?: string): Promise<void> {
  try {
    await ensureAudioMode();
    const { data, error } = await supabase.functions.invoke<SynthesizeSpeechResponse>("synthesize-speech", {
      body: { text, voiceId },
    });
    if (error || !data?.audioBase64) return;

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
  } catch {
    // Best-effort — see comment above.
  }
}

export async function stopSpeaking(): Promise<void> {
  if (!currentSound) return;
  await currentSound.unloadAsync().catch(() => {});
  currentSound = null;
}
