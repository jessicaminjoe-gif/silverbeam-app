import Anthropic from "npm:@anthropic-ai/sdk@^0.27.0";
import type { CompanionContext, CompanionMessage, CompanionProvider, CompanionReply } from "../CompanionProvider.ts";
import { buildCompanionSystemPrompt } from "../CompanionProvider.ts";
import { parseEscalationTag } from "../escalation.ts";

// Lazy client construction — see providers/openai.ts for why. Both provider
// modules are imported unconditionally regardless of which AI_PROVIDER is
// selected, so eagerly constructing the SDK client here would crash the
// function on cold start whenever only OPENAI_API_KEY is configured.
let client: Anthropic | undefined;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
  return client;
}
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5";

function buildContextPreamble(context: CompanionContext): string {
  const lines = [`The person you're speaking with is named ${context.seniorName ?? "the user"}.`];
  if (context.recentCheckIns?.length) {
    lines.push(`Recent check-in summaries (most recent first): ${context.recentCheckIns.join(" | ")}`);
  }
  return lines.join(" ");
}

export const anthropicProvider: CompanionProvider = {
  name: "anthropic",

  async sendMessage(
    history: CompanionMessage[],
    newMessage: string,
    context: CompanionContext
  ): Promise<CompanionReply> {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 300,
      system: `${buildCompanionSystemPrompt(context.companionName)}\n\n${buildContextPreamble(context)}`,
      messages: [
        ...history
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: newMessage },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const { message, result } = parseEscalationTag(raw);
    return { message, escalation: result };
  },

  async detectEscalation(text: string) {
    // The primary escalation signal comes from the tag parsed in
    // sendMessage(); this standalone check exists for callers (e.g. a
    // future batch/audit job) that need to classify arbitrary text without
    // a full conversation turn.
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 60,
      system:
        'Classify the severity of distress or medical concern in the message. Respond with exactly one tag: <escalation severity="none|low|medium|high" reason="short reason"/>',
      messages: [{ role: "user", content: text }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    return parseEscalationTag(raw).result;
  },
};
