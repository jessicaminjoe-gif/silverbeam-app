// SilverBeam `chat` Edge Function
//
// Flow: senior sends a message -> load recent context -> call the
// provider-agnostic CompanionProvider -> persist both messages -> run the
// escalation protocol (keyword scan + LLM self-tag, higher severity wins)
// -> on trigger, log an escalation_events row and notify the linked family
// (+ the founder, as a beta-only human backstop) -> return the reply.
//
// Deploy: supabase functions deploy chat
// Secrets: supabase secrets set AI_PROVIDER=anthropic ANTHROPIC_API_KEY=...
//   TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=...
//   FOUNDER_ALERT_PUSH_TOKEN=...

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";
import { getProvider } from "./companion/config.ts";
import { scanKeywords, combineEscalation } from "./companion/escalation.ts";
import type { ChatRequestBody } from "./companion/CompanionProvider.ts";
import type { EscalationResult } from "./companion/CompanionProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sendExpoPush(token: string, title: string, body: string) {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ to: token, title, body, sound: "default", priority: "high" }),
  });
  // Must consume the body, not just await fetch() for headers — found via
  // create-call hitting the same issue: an unread response body let the
  // Edge Function's isolate tear down the outbound request after the
  // handler returned, so the push silently never actually reached Expo's
  // API despite the fetch() promise resolving normally.
  const resBody = await res.text();
  if (!res.ok) console.error("[chat] push send failed:", res.status, resBody);
}

async function sendTwilioSms(toPhone: string, body: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!sid || !authToken || !from) return;
  const creds = btoa(`${sid}:${authToken}`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: toPhone, From: from, Body: body }),
  });
  const resBody = await res.text();
  if (!res.ok) console.error("[chat] Twilio SMS send failed:", res.status, resBody);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // User-scoped client: respects RLS, used to confirm identity and for
    // all reads/writes that a senior is normally allowed to do.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service-role client: bypasses RLS. Used ONLY for escalation_events
    // inserts and looking up linked family for notification — this is the
    // one place a client-triggered write must not be blockable by the
    // client itself.
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const body = (await req.json()) as ChatRequestBody;
    if (!body?.message || !body?.seniorId) {
      return new Response(JSON.stringify({ error: "message and seniorId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    if (body.seniorId !== user.id) {
      return new Response(JSON.stringify({ error: "seniorId must match the authenticated user" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { data: profile } = await userClient
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "senior") {
      return new Response(JSON.stringify({ error: "Only senior accounts can chat with the companion" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { data: recentMessages } = await userClient
      .from("conversation_messages")
      .select("role, content")
      .eq("senior_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: recentCheckIns } = await userClient
      .from("check_ins")
      .select("summary")
      .eq("senior_id", user.id)
      .not("summary", "is", null)
      .order("occurred_at", { ascending: false })
      .limit(3);

    const { data: companionSettings } = await userClient
      .from("companion_settings")
      .select("companion_name, senior_nickname")
      .eq("senior_id", user.id)
      .maybeSingle();

    const history = (recentMessages ?? [])
      .reverse()
      .map((m) => ({ role: m.role === "senior" ? ("user" as const) : ("assistant" as const), content: m.content }));

    const provider = getProvider();
    const reply = await provider.sendMessage(history, body.message, {
      seniorId: user.id,
      // Nickname is only how the companion addresses them in conversation —
      // full_name stays the account's actual display name everywhere else
      // (call bubbles, dashboard, History).
      seniorName: companionSettings?.senior_nickname || profile.full_name,
      companionName: companionSettings?.companion_name,
      recentCheckIns: (recentCheckIns ?? []).map((c) => c.summary).filter(Boolean) as string[],
    });

    // Combine the LLM's self-reported tag with a deterministic keyword scan
    // over the senior's raw message — belt-and-suspenders for a
    // safety-relevant signal.
    const keywordResult = scanKeywords(body.message);
    const finalEscalation: EscalationResult = combineEscalation(keywordResult, reply.escalation);

    const { data: seniorMsgRow } = await userClient
      .from("conversation_messages")
      .insert({ senior_id: user.id, check_in_id: body.checkInId ?? null, role: "senior", content: body.message })
      .select("id")
      .single();

    await userClient.from("conversation_messages").insert({
      senior_id: user.id,
      check_in_id: body.checkInId ?? null,
      role: "assistant",
      content: reply.message,
    });

    if (finalEscalation.triggered && finalEscalation.severity !== "none") {
      const { data: links } = await serviceClient
        .from("senior_family_links")
        .select("family_member_id, is_emergency_contact")
        .eq("senior_id", user.id)
        .order("is_emergency_contact", { ascending: false });

      const primaryContact = links?.[0];

      const { data: insertedEscalation } = await serviceClient
        .from("escalation_events")
        .insert({
          senior_id: user.id,
          check_in_id: body.checkInId ?? null,
          conversation_message_id: seniorMsgRow?.id ?? null,
          severity: finalEscalation.severity,
          trigger_reason: finalEscalation.reason ?? null,
          detected_keywords: finalEscalation.matchedSignals ?? null,
          notified_family_member_id: primaryContact?.family_member_id ?? null,
        })
        .select("id")
        .single();

      let notificationMethod: "push" | "sms" | "both" | null = null;

      if (primaryContact) {
        const { data: familyPushTokens } = await serviceClient
          .from("push_tokens")
          .select("token")
          .eq("profile_id", primaryContact.family_member_id);

        const { data: familyProfile } = await serviceClient
          .from("profiles")
          .select("phone")
          .eq("id", primaryContact.family_member_id)
          .single();

        const alertTitle = `${profile.full_name} may need you`;
        const alertBody = finalEscalation.reason ?? "SilverBeam noticed a possible concern during today's check-in.";

        for (const t of familyPushTokens ?? []) {
          await sendExpoPush(t.token, alertTitle, alertBody);
        }
        notificationMethod = (familyPushTokens?.length ?? 0) > 0 ? "push" : null;

        if (finalEscalation.severity === "high" && familyProfile?.phone) {
          await sendTwilioSms(familyProfile.phone, `SilverBeam alert: ${alertTitle}. ${alertBody}`);
          notificationMethod = notificationMethod === "push" ? "both" : "sms";
        }
      }

      // Beta-only human backstop: also alert the founder on medium/high.
      const founderToken = Deno.env.get("FOUNDER_ALERT_PUSH_TOKEN");
      if (founderToken && (finalEscalation.severity === "medium" || finalEscalation.severity === "high")) {
        await sendExpoPush(
          founderToken,
          `[Beta backstop] ${profile.full_name}`,
          `${finalEscalation.severity.toUpperCase()}: ${finalEscalation.reason ?? "possible concern"}`
        );
      }

      if (insertedEscalation && notificationMethod) {
        await serviceClient
          .from("escalation_events")
          .update({ notification_method: notificationMethod, notification_sent_at: new Date().toISOString() })
          .eq("id", insertedEscalation.id);
      }
    }

    return new Response(JSON.stringify({ message: reply.message, escalation: finalEscalation }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
