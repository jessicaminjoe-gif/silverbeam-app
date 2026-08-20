// SilverBeam `check-call-presence` Edge Function
//
// Lets the senior's call screen poll "has the other person joined yet?"
// without exposing DAILY_API_KEY to the client. Used to auto-disconnect an
// unanswered call after ~30s instead of leaving the senior sitting on a
// silently ringing screen indefinitely.
//
// Deploy: supabase functions deploy check-call-presence
// Secrets: supabase secrets set DAILY_API_KEY=...

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY")!;

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

    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { roomName } = (await req.json().catch(() => ({}))) as { roomName?: string };
    if (!roomName) {
      return new Response(JSON.stringify({ error: "roomName is required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Confirm this caller actually placed this call — without this, any
    // authenticated user could poll presence for any room by guessing/
    // enumerating names.
    const { data: callEvent } = await userClient
      .from("call_events")
      .select("id")
      .eq("senior_id", user.id)
      .eq("room_name", roomName)
      .maybeSingle();
    if (!callEvent) {
      return new Response(JSON.stringify({ error: "Not your call" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const presenceRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}/presence`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });
    if (!presenceRes.ok) {
      console.error("[check-call-presence] Daily presence request failed:", presenceRes.status, await presenceRes.text());
      return new Response(JSON.stringify({ error: "Could not check presence" }), {
        status: 502,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const { total_count: totalCount } = (await presenceRes.json()) as { total_count: number };

    return new Response(JSON.stringify({ totalCount }), {
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
