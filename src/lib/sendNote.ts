import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";

// Edge Functions return their own {error} JSON body on a non-2xx response,
// but supabase-js's FunctionsHttpError only exposes that through `context`
// (a Response), not `.message` -- this pulls the friendlier message out so
// callers can show e.g. "Could not understand the voice note" instead of a
// generic failure.
async function friendlyError(error: unknown, fallback: string): Promise<Error> {
  const context = (error as { context?: Response })?.context;
  if (context) {
    try {
      const body = (await context.clone().json()) as { error?: string };
      if (body.error) return new Error(body.error);
    } catch {
      // Response body wasn't JSON -- fall through to the fallback below.
    }
  }
  return error instanceof Error ? error : new Error(fallback);
}

// Thin wrapper around the send-note Edge Function, matching the shape of
// pickAndSharePhoto in uploadPhoto.ts. Throws on failure so callers can
// show their own error UI.
export async function sendNoteToSenior(seniorId: string, body: string): Promise<void> {
  const { error } = await supabase.functions.invoke("send-note", {
    body: { seniorId, body },
  });
  if (error) throw await friendlyError(error, "Could not send note");
}

// Uploads a locally-recorded voice note to the private "voice-notes"
// bucket, then calls send-note with the storage path -- the function
// transcribes it server-side (Whisper) and uses that as the note's body,
// so playback and the transcript both end up on the same row. Returns the
// transcript so the caller can show "Sent: <transcript>" for reassurance
// that the recording came through as intended.
export async function sendVoiceNoteToSenior(seniorId: string, localUri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const path = `${seniorId}/${Date.now()}.m4a`;
  const { error: uploadError } = await supabase.storage.from("voice-notes").upload(path, decode(base64), {
    contentType: "audio/m4a",
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase.functions.invoke<{ ok: boolean; body: string }>("send-note", {
    body: { seniorId, audioPath: path },
  });
  if (error || !data) throw await friendlyError(error, "Could not send voice note");
  return data.body;
}
