import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FamilyNote, NoteReaction } from "@/types/database";

export interface FamilyNoteItem extends FamilyNote {
  // Non-null only for voice notes -- see migration 0020. Minted in a
  // single batched call per load, same approach as useSharedMedia.ts,
  // since the "voice-notes" bucket is private.
  audioSignedUrl: string | null;
}

const SIGNED_URL_EXPIRES_IN = 60 * 60; // 1 hour, plenty for one viewing session

// Senior-side: mirrors useSharedMedia.ts's shape (unreadCount, markAllViewed).
export function useFamilyNotes(seniorId: string | undefined) {
  const [notes, setNotes] = useState<FamilyNoteItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!seniorId) return;
    const { data } = await supabase
      .from("family_notes")
      .select("*")
      .eq("senior_id", seniorId)
      .order("created_at", { ascending: false });
    const rows = (data as FamilyNote[]) ?? [];

    const audioPaths = rows.map((n) => n.audio_path).filter((p): p is string => !!p);
    let signedByPath = new Map<string, string>();
    if (audioPaths.length) {
      const { data: signed } = await supabase.storage.from("voice-notes").createSignedUrls(audioPaths, SIGNED_URL_EXPIRES_IN);
      signedByPath = new Map((signed ?? []).map((s, i) => [audioPaths[i], s.signedUrl]));
    }

    setNotes(rows.map((n) => ({ ...n, audioSignedUrl: n.audio_path ? (signedByPath.get(n.audio_path) ?? null) : null })));
    setLoading(false);
  }, [seniorId]);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = notes.filter((n) => !n.viewed_at).length;

  const markAllViewed = useCallback(async () => {
    if (!seniorId) return;
    const unviewedIds = notes.filter((n) => !n.viewed_at).map((n) => n.id);
    if (!unviewedIds.length) return;
    await supabase.from("family_notes").update({ viewed_at: new Date().toISOString() }).in("id", unviewedIds);
    setNotes((prev) => prev.map((n) => (unviewedIds.includes(n.id) ? { ...n, viewed_at: new Date().toISOString() } : n)));
  }, [seniorId, notes]);

  // Tapping the already-selected reaction again clears it (pass null) --
  // one reaction per note, not a toggleable multi-select.
  const setReaction = useCallback(
    async (noteId: string, reaction: NoteReaction | null) => {
      const previous = notes.find((n) => n.id === noteId)?.reaction ?? null;
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, reaction } : n)));
      const { error } = await supabase.from("family_notes").update({ reaction }).eq("id", noteId);
      if (error) {
        // Roll back on failure -- best-effort optimistic update.
        setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, reaction: previous } : n)));
      }
    },
    [notes]
  );

  // Tapping the already-selected quick reply again clears it (pass null) --
  // same one-at-a-time pattern as setReaction, just a separate column so a
  // note can carry both an emoji and a text reply at once.
  const setReplyText = useCallback(
    async (noteId: string, replyText: string | null) => {
      const previous = notes.find((n) => n.id === noteId)?.reply_text ?? null;
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, reply_text: replyText } : n)));
      const { error } = await supabase.from("family_notes").update({ reply_text: replyText }).eq("id", noteId);
      if (error) {
        setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, reply_text: previous } : n)));
      }
    },
    [notes]
  );

  return { notes, unreadCount, loading, reload: load, markAllViewed, setReaction, setReplyText };
}
