import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/state/useSession";
import { speak } from "@/lib/speech";
import type { CompanionReply } from "@/ai/types";

export interface ChatEntry {
  id: string;
  role: "senior" | "assistant";
  content: string;
}

export function useCompanionChat() {
  const profile = useSession((s) => s.profile);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("conversation_messages")
      .select("id, role, content")
      .eq("senior_id", profile.id)
      .order("created_at", { ascending: true })
      .limit(50)
      .then(({ data }) => {
        setMessages((data as ChatEntry[]) ?? []);
        setLoadingHistory(false);
      });
  }, [profile?.id]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!profile || !text.trim()) return;
      const optimisticId = `local-${Date.now()}`;
      setMessages((prev) => [...prev, { id: optimisticId, role: "senior", content: text }]);
      setSending(true);
      try {
        const { data, error } = await supabase.functions.invoke<CompanionReply>("chat", {
          body: { seniorId: profile.id, message: text },
        });
        if (error) throw error;
        if (data) {
          setMessages((prev) => [
            ...prev,
            { id: `${optimisticId}-reply`, role: "assistant", content: data.message },
          ]);
          // Fire-and-forget: don't block the text reply (which already
          // rendered) on how long speech synthesis + playback takes.
          speak(data.message);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `${optimisticId}-error`,
            role: "assistant",
            content: "I'm having trouble right now. Please try again in a moment.",
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [profile?.id]
  );

  const replay = useCallback((content: string) => {
    speak(content);
  }, []);

  return { messages, sendMessage, sending, loadingHistory, replay };
}
