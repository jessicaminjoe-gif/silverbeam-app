import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Daily doesn't end a call for the other participant just because one side
// leaves -- a 1:1 call where one person hangs up otherwise leaves the
// other sitting in an empty room. This is a lightweight realtime broadcast
// (no DB row, nothing to clean up) that both sides of a call subscribe to
// by room name, so leaving on one side ends it on the other too.
export async function broadcastCallEnded(roomName: string): Promise<void> {
  const channel = supabase.channel(`call:${roomName}`);
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
    });
  });
  await channel.send({ type: "broadcast", event: "ended", payload: {} });
  supabase.removeChannel(channel);
}

export function useCallEndListener(roomName: string | null | undefined, onEnded: () => void) {
  useEffect(() => {
    if (!roomName) return;
    const channel = supabase
      .channel(`call:${roomName}`)
      .on("broadcast", { event: "ended" }, () => onEnded())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName]);
}
