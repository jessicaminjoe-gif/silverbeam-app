import { useCallback, useRef, useState } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { supabase } from "@/lib/supabase";

interface TranscribeResponse {
  text: string;
}

export type VoiceInputState = "idle" | "recording" | "transcribing";

// Records locally via expo-av, then uploads to the transcribe-speech Edge
// Function (OpenAI Whisper) rather than using on-device speech recognition —
// deliberately chosen over the free on-device option since that requires
// Android 12+ / iOS 17+, which would silently exclude some beta seniors'
// devices from voice input entirely.
export function useVoiceInput() {
  const [state, setState] = useState<VoiceInputState>("idle");
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = useCallback(async (): Promise<boolean> => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) return false;

    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    recordingRef.current = recording;
    setState("recording");
    return true;
  }, []);

  // Returns the transcribed text, or null if recording/transcription failed
  // (caller decides how to surface that — the chat input just leaves
  // whatever was already typed unchanged).
  const stopRecording = useCallback(async (): Promise<string | null> => {
    const recording = recordingRef.current;
    if (!recording) return null;
    setState("transcribing");
    try {
      await recording.stopAndUnloadAsync();
      // Releases the mic and lets audio routing return to normal playback —
      // recommended by expo-av after recording ends.
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const uri = recording.getURI();
      recordingRef.current = null;
      if (!uri) return null;

      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const { data, error } = await supabase.functions.invoke<TranscribeResponse>("transcribe-speech", {
        body: { audioBase64, mimeType: "audio/m4a" },
      });
      if (error || !data?.text) {
        console.error("[useVoiceInput] transcribe-speech failed:", error?.message);
        return null;
      }
      return data.text;
    } finally {
      setState("idle");
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    await recording.stopAndUnloadAsync().catch(() => {});
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
    recordingRef.current = null;
    setState("idle");
  }, []);

  return { state, startRecording, stopRecording, cancelRecording };
}
