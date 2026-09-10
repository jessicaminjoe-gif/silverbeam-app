import { supabase } from "@/lib/supabase";

export interface CreateInviteResult {
  code: string;
  expiresAt: string;
}

export async function createInvite(seniorId: string, relationship?: string): Promise<CreateInviteResult> {
  const { data, error } = await supabase.functions.invoke<CreateInviteResult>("create-invite", {
    body: { seniorId, relationship },
  });
  if (error || !data) throw error ?? new Error("Could not create invite");
  return data;
}

export interface RedeemInviteResult {
  seniorId: string;
  seniorFullName: string;
}

// Edge Functions return their own {error} JSON body on a non-2xx response,
// but supabase-js's FunctionsHttpError only exposes that through `context`
// (a Response), not `.message` -- this pulls the friendlier message out so
// callers can show "That code has expired" instead of a generic failure.
export async function redeemInvite(code: string): Promise<RedeemInviteResult> {
  const { data, error } = await supabase.functions.invoke<RedeemInviteResult>("redeem-invite", {
    body: { code },
  });
  if (error || !data) {
    const context = (error as { context?: Response })?.context;
    let serverMessage: string | undefined;
    if (context) {
      try {
        const body = (await context.clone().json()) as { error?: string };
        serverMessage = body.error;
      } catch {
        // Response body wasn't JSON -- fall through to the generic error.
      }
    }
    throw new Error(serverMessage ?? error?.message ?? "Could not redeem invite");
  }
  return data;
}
