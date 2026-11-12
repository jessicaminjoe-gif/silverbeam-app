import { createContext, useContext } from "react";
import { useCompanionSettings } from "@/hooks/useCompanionSettings";
import { useSession } from "@/state/useSession";
import { MAX_TEXT_SCALE, TABLET_TEXT_BOOST, useIsTablet } from "@/lib/device";

const TextScaleContext = createContext(1.0);

// Wraps the senior-facing stack so every screen's text can read the
// family-configured scale (see SeniorContactSettings.tsx) without each
// screen fetching companion_settings itself.
export function TextScaleProvider({ children }: { children: React.ReactNode }) {
  const profile = useSession((s) => s.profile);
  const { settings } = useCompanionSettings(profile?.id);
  const isTablet = useIsTablet();
  const scale = Math.min(MAX_TEXT_SCALE, settings.text_scale * (isTablet ? TABLET_TEXT_BOOST : 1));
  return <TextScaleContext.Provider value={scale}>{children}</TextScaleContext.Provider>;
}

export function useTextScale() {
  return useContext(TextScaleContext);
}
