import { supabase } from "@/lib/supabase";

// Thin wrapper around the send-note Edge Function, matching the shape of
// pickAndSharePhoto in uploadPhoto.ts. Throws on failure so callers can
// show their own error UI.
export async function sendNoteToSenior(seniorId: string, body: string): Promise<void> {
  const { error } = await supabase.functions.invoke("send-note", {
    body: { seniorId, body },
  });
  if (error) throw error;
}
