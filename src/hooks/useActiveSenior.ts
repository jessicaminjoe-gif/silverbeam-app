import { useEffect, useState } from "react";
import { useLinkedSeniors } from "./useLinkedSeniors";

// Wraps useLinkedSeniors with an explicit "which one am I looking at"
// selection, defaulting to the newest link. Exists because a family
// account can be linked to more than one senior (multiple real family
// members, or — during beta testing — several re-setup test devices), and
// silently guessing which one to show has bitten this app twice already:
// whichever one is "first" isn't necessarily the one whose data you
// actually want to see.
export function useActiveSenior() {
  const { seniors, loading, reload } = useLinkedSeniors();
  const [activeSeniorId, setActiveSeniorId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    // Falls back to newest-first whenever the current selection is
    // missing/invalid (first load, or the previously-active senior just
    // got unlinked) — never on every render, so an explicit switch sticks.
    if (!seniors.some((s) => s.seniorId === activeSeniorId)) {
      setActiveSeniorId(seniors[0]?.seniorId ?? null);
    }
  }, [loading, seniors, activeSeniorId]);

  const activeSenior = seniors.find((s) => s.seniorId === activeSeniorId) ?? null;

  return { activeSenior, seniors, loading, setActiveSeniorId, reload };
}
