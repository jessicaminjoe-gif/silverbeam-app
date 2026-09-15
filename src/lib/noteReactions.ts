import type { NoteReaction } from "@/types/database";

// Shared between love-notes.tsx (senior picks a reaction) and updates.tsx
// (family sees what was picked) so the emoji/label pairing only lives in
// one place.
export const NOTE_REACTIONS: { key: NoteReaction; emoji: string; label: string }[] = [
  { key: "heart", emoji: "❤️", label: "Heart" },
  { key: "thumbs_up", emoji: "👍", label: "Thumbs up" },
  { key: "smile", emoji: "😊", label: "Smiley face" },
  { key: "laugh", emoji: "😂", label: "Laughing" },
  { key: "sad", emoji: "😢", label: "Sad face" },
];

export const NOTE_REACTION_EMOJI: Record<NoteReaction, string> = Object.fromEntries(
  NOTE_REACTIONS.map((r) => [r.key, r.emoji])
) as Record<NoteReaction, string>;

// Canned one-tap text replies, next to the emoji row -- kept short and
// generic enough to fit any note without needing to type.
export const QUICK_REPLIES = ["Hello", "Thank you", "That's so nice", "Love you too!"];
