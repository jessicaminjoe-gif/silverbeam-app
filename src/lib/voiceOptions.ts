// OpenAI tts-1 preset voices, curated to the ones that read as warm/clear
// for an older-adult listener. voiceId values must stay valid OpenAI voice
// names — synthesize-speech falls back to a default for anything else.
//
// Each voice carries a fixed persona name -- picking the voice IS naming
// the companion, rather than family typing a name separately. Keeps the
// two from ever feeling mismatched (e.g. a soft/gentle voice introducing
// itself with a name that reads as brisk or masculine).
export const VOICE_OPTIONS = [
  { voiceId: "nova", name: "Grace", label: "Warm & Friendly" },
  { voiceId: "shimmer", name: "Rose", label: "Gentle & Soft" },
  { voiceId: "onyx", name: "George", label: "Steady & Calm" },
  { voiceId: "echo", name: "Walter", label: "Clear & Familiar" },
] as const;

export const VOICE_PREVIEW_TEXT = "Hi, this is how I'll sound when we chat.";
