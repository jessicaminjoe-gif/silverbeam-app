// OpenAI tts-1 preset voices, curated to the ones that read as warm/clear
// for an older-adult listener. voiceId values must stay valid OpenAI voice
// names — synthesize-speech falls back to a default for anything else.
export const VOICE_OPTIONS = [
  { voiceId: "nova", label: "Warm & Friendly" },
  { voiceId: "shimmer", label: "Gentle & Soft" },
  { voiceId: "onyx", label: "Steady & Calm" },
  { voiceId: "echo", label: "Clear & Familiar" },
] as const;

export const VOICE_PREVIEW_TEXT = "Hi, this is how I'll sound when we chat.";
