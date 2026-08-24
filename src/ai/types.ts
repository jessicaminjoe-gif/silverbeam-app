// Client-side mirror of the server-side CompanionProvider contract
// (supabase/functions/chat/companion/CompanionProvider.ts). The app never
// calls an AI provider directly — it only calls the `chat` Edge Function,
// which returns this shape.

export interface CompanionMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface EscalationResult {
  triggered: boolean;
  severity: "none" | "low" | "medium" | "high";
  reason?: string;
  matchedSignals?: string[];
}

export interface CompanionReply {
  message: string;
  escalation: EscalationResult;
}

export interface ChatRequestBody {
  seniorId: string;
  checkInId?: string;
  message?: string;
  // Alternate mode: no message, no escalation check -- generates a
  // proactive time-of-day greeting woven with weather/news/reminders
  // (chat/index.ts's briefing branch). Response is just { message }, no
  // escalation field.
  briefing?: boolean;
}
