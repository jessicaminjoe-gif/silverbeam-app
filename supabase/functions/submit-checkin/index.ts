// SilverBeam `submit-checkin` Edge Function
//
// Records a senior's daily check-in and notifies linked family — moved out
// of a plain client-side insert (as everything with a family-facing side
// effect does in this app) so the notification logic lives server-side
// with the rest of it, not duplicated in the mobile client.
//
// Deploy: supabase functions deploy submit-checkin

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

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
  // See create-call/chat for why the body must be consumed, not just awaited.
  const resBody = await res.text();
  if (!res.ok) console.error("[submit-checkin] push send failed:", res.status, resBody);
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

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
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

    const { data: profile } = await userClient.from("profiles").select("role, full_name").eq("id", user.id).single();
    if (profile?.role !== "senior") {
      return new Response(JSON.stringify({ error: "Only senior accounts can check in" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { label, emoji } = (await req.json().catch(() => ({}))) as { label?: string; emoji?: string };
    if (!label) {
      return new Response(JSON.stringify({ error: "label is required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { error: insertError } = await userClient
      .from("check_ins")
      .insert({ senior_id: user.id, summary: label, mood_emoji: emoji ?? null, completed: true });
    if (insertError) {
      console.error("[submit-checkin] insert failed:", insertError.message);
      return new Response(JSON.stringify({ error: "Could not save check-in" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { data: links, error: linksError } = await serviceClient
      .from("senior_family_links")
      .select("family_member_id")
      .eq("senior_id", user.id);
    if (linksError) console.error("[submit-checkin] senior_family_links lookup failed:", linksError.message);

    for (const link of links ?? []) {
      const { data: tokens, error: tokensError } = await serviceClient
        .from("push_tokens")
        .select("token")
        .eq("profile_id", link.family_member_id);
      if (tokensError) console.error("[submit-checkin] push_tokens lookup failed:", tokensError.message);
      for (const t of tokens ?? []) {
        await sendExpoPush(t.token, `${profile.full_name} checked in`, label);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
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
