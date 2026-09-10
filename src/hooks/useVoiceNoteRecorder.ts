import { useCallback, useRef, useState } from "react";
import { Audio } from "expo-av";

export type VoiceNoteRecorderState = "idle" | "recording" | "recorded";

// Records locally via expo-av and hands back a local file URI -- unlike
// useVoiceInput (which transcribes immediately and discards the audio),
// this keeps the actual recording so it can be uploaded and played back,
// since a voice note is meant to be heard in the sender's own voice, not
// just read as text.
export function useVoiceNoteRecorder() {
  const [state, setState] = useState<VoiceNoteRecorderState>("idle");
  const [uri, setUri] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);

  const startRecording = useCallback(async (): Promise<boolean> => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) return false;

    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    recordingRef.current = recording;
    setUri(null);
    setState("recording");
    return true;
  }, []);

  const stopRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    recordingRef.current = null;
    setUri(recording.getURI());
    setState("recorded");
  }, []);

  const playPreview = useCallback(async () => {
    if (!uri) return;
    if (previewSoundRef.current) {
      await previewSoundRef.current.unloadAsync().catch(() => {});
      previewSoundRef.current = null;
    }
    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
    previewSoundRef.current = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (previewSoundRef.current === sound) previewSoundRef.current = null;
      }
    });
  }, [uri]);

  const reset = useCallback(async () => {
    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
    if (previewSoundRef.current) {
      await previewSoundRef.current.unloadAsync().catch(() => {});
      previewSoundRef.current = null;
    }
    setUri(null);
    setState("idle");
  }, []);

  return { state, uri, startRecording, stopRecording, playPreview, reset };
}
