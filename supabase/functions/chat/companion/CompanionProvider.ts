// Provider-agnostic AI companion interface. Runs server-side only (Edge
// Function) — never import an AI SDK or hold an API key in the mobile app.
// Swapping providers = change the AI_PROVIDER secret + redeploy this
// function; no app rebuild or store release required.

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

export interface CompanionContext {
  seniorId: string;
  seniorName?: string;
  companionName?: string;
  recentCheckIns?: string[];
}

// Mirrors src/ai/types.ts on the client side — duplicated here because Edge
// Functions run under Deno and can't import across the RN app's module graph.
export interface ChatRequestBody {
  seniorId: string;
  checkInId?: string;
  message: string;
}

export interface CompanionProvider {
  name: string;
  sendMessage(
    history: CompanionMessage[],
    newMessage: string,
    context: CompanionContext
  ): Promise<CompanionReply>;
  detectEscalation(text: string): Promise<EscalationResult>;
}

// companionName defaults to the product name so an unconfigured senior
// account (companion_settings row not created yet) still gets a coherent
// prompt instead of an empty/undefined name.
export function buildCompanionSystemPrompt(companionName = "SilverBeam"): string {
  return `You are ${companionName}, a warm, patient AI companion for an older adult.
Speak simply and kindly, keep replies short (2-4 sentences), and never give medical advice or a diagnosis.
If the person describes a medical emergency, chest pain, a fall, severe confusion, or thoughts of harming
themselves, gently tell them to call 911 or their emergency contact right away, in addition to anything
else you say.

After your reply to the person, on a new line, append a machine-readable tag exactly in this form and
nothing else on that line:
<escalation severity="none|low|medium|high" reason="short reason"/>
Use "none" for ordinary conversation. Use "low" for mild loneliness or a bad day. Use "medium" for
persistent distress, confusion, or a possible health concern. Use "high" for anything suggesting an
immediate medical emergency or safety risk.`;
}
