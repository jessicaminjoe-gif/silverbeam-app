import type { CompanionProvider } from "./CompanionProvider.ts";
import { anthropicProvider } from "./providers/anthropic.ts";
import { openaiProvider } from "./providers/openai.ts";

// Swap providers by changing the AI_PROVIDER secret (`supabase secrets set
// AI_PROVIDER=openai`) and redeploying the `chat` function — no client
// changes needed.
export function getProvider(): CompanionProvider {
  const configured = (Deno.env.get("AI_PROVIDER") ?? "anthropic").toLowerCase();
  switch (configured) {
    case "openai":
      return openaiProvider;
    case "anthropic":
      return anthropicProvider;
    default:
      throw new Error(`Unknown AI_PROVIDER "${configured}" — expected "anthropic" or "openai".`);
  }
}
