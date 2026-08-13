import { useCallback, useRef, useState } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { supabase } from "@/lib/supabase";

interface TranscribeResponse {
  text: string;
}

export interface TranscribeResult {
  text: string | null;
  errorMessage?: string;
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

  // Returns the transcribed text, or an errorMessage if recording/
  // transcription failed — this used to fail completely silently, which
  // made "the mic doesn't work" impossible to diagnose from a report alone.
  const stopRecording = useCallback(async (): Promise<TranscribeResult> => {
    const recording = recordingRef.current;
    if (!recording) return { text: null, errorMessage: "No recording in progress" };
    setState("transcribing");
    try {
      await recording.stopAndUnloadAsync();
      // Releases the mic and lets audio routing return to normal playback —
      // recommended by expo-av after recording ends.
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const uri = recording.getURI();
      recordingRef.current = null;
      if (!uri) return { text: null, errorMessage: "Recording produced no audio file" };

      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const { data, error } = await supabase.functions.invoke<TranscribeResponse>("transcribe-speech", {
        body: { audioBase64, mimeType: "audio/m4a" },
      });
      if (error || !data?.text) {
        const message = error?.message ?? "No speech detected";
        console.error("[useVoiceInput] transcribe-speech failed:", message);
        return { text: null, errorMessage: message };
      }
      return { text: data.text };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useVoiceInput] recording failed:", message);
      return { text: null, errorMessage: message };
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
