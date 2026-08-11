import OpenAI from "npm:openai@^4.55.0";
import type { CompanionContext, CompanionMessage, CompanionProvider, CompanionReply } from "../CompanionProvider.ts";
import { buildCompanionSystemPrompt } from "../CompanionProvider.ts";
import { parseEscalationTag } from "../escalation.ts";

// Lazy client construction — this module is imported unconditionally by
// config.ts alongside the Anthropic provider, regardless of which one
// AI_PROVIDER actually selects. The OpenAI SDK throws synchronously in its
// constructor when no API key is present, so building it eagerly at import
// time would crash the whole function on cold start whenever only
// ANTHROPIC_API_KEY is configured.
let client: OpenAI | undefined;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
  return client;
}
const MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o";

function buildContextPreamble(context: CompanionContext): string {
  const lines = [`The person you're speaking with is named ${context.seniorName ?? "the user"}.`];
  if (context.recentCheckIns?.length) {
    lines.push(`Recent check-in summaries (most recent first): ${context.recentCheckIns.join(" | ")}`);
  }
  return lines.join(" ");
}

export const openaiProvider: CompanionProvider = {
  name: "openai",

  async sendMessage(
    history: CompanionMessage[],
    newMessage: string,
    context: CompanionContext
  ): Promise<CompanionReply> {
    const completion = await getClient().chat.completions.create({
      model: MODEL,
      max_tokens: 300,
      messages: [
        { role: "system", content: `${buildCompanionSystemPrompt(context.companionName)}\n\n${buildContextPreamble(context)}` },
        ...history
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: newMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const { message, result } = parseEscalationTag(raw);
    return { message, escalation: result };
  },

  async detectEscalation(text: string) {
    const completion = await getClient().chat.completions.create({
      model: MODEL,
      max_tokens: 60,
      messages: [
        {
          role: "system",
          content:
            'Classify the severity of distress or medical concern in the message. Respond with exactly one tag: <escalation severity="none|low|medium|high" reason="short reason"/>',
        },
        { role: "user", content: text },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    return parseEscalationTag(raw).result;
  },
};
