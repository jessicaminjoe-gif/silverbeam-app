import { createContext, useContext } from "react";
import { useCompanionSettings } from "@/hooks/useCompanionSettings";
import { useSession } from "@/state/useSession";

const TextScaleContext = createContext(1.0);

// Wraps the senior-facing stack so every screen's text can read the
// family-configured scale (see SeniorContactSettings.tsx) without each
// screen fetching companion_settings itself.
export function TextScaleProvider({ children }: { children: React.ReactNode }) {
  const profile = useSession((s) => s.profile);
  const { settings } = useCompanionSettings(profile?.id);
  return <TextScaleContext.Provider value={settings.text_scale}>{children}</TextScaleContext.Provider>;
}

export function useTextScale() {
  return useContext(TextScaleContext);
}
