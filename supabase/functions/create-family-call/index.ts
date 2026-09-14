// SilverBeam `create-family-call` Edge Function
//
// Family-initiated counterpart to `create-call` (senior-initiated). Creates
// a Daily room, mints a separate meeting token for each side (so both get
// their name prefilled and skip Daily's prejoin lobby), and pushes the
// senior an incoming-call notification routed to the Answer/Not-now screen
// -- unlike a senior calling out (which the senior chose to do), an
// unexpected incoming call needs that extra step before video goes live.
//
// Deploy: supabase functions deploy create-family-call
// Secrets: supabase secrets set DAILY_API_KEY=...

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void } | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY")!;

async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  channelId?: string
) {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ to: token, title, body, data, sound: "default", priority: "high", channelId }),
  });
  const resBody = await res.text();
  if (!res.ok) console.error("[create-family-call] push send failed:", res.status, resBody);
}

async function scheduleRepeatPushes(
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  channelId: string
) {
  for (let i = 0; i < 2; i++) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await sendExpoPush(token, title, body, data, channelId);
  }
}

async function mintMeetingToken(roomName: string, userName: string): Promise<string | null> {
  const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName,
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
        redirect_on_meeting_exit: "silverbeam://call-ended",
      },
    }),
  });
  if (!tokenRes.ok) {
    console.error("[create-family-call] meeting token creation failed:", tokenRes.status, await tokenRes.text());
    return null;
  }
  const { token } = (await tokenRes.json()) as { token: string };
  return token;
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
    if (profile?.role !== "family") {
      return new Response(JSON.stringify({ error: "Only family accounts can start this kind of call" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { seniorId } = (await req.json().catch(() => ({}))) as { seniorId?: string };
    if (!seniorId) {
      return new Response(JSON.stringify({ error: "seniorId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { data: link } = await userClient
      .from("senior_family_links")
      .select("relationship")
      .eq("senior_id", seniorId)
      .eq("family_member_id", user.id)
      .maybeSingle();
    if (!link) {
      return new Response(JSON.stringify({ error: "Not a linked family member" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Family can turn video calling off (see companion_settings) -- enforced
    // here, not just by hiding the button client-side, so a stale client
    // can't bypass it.
    const { data: companionSettings } = await userClient
      .from("companion_settings")
      .select("video_call_enabled")
      .eq("senior_id", seniorId)
      .maybeSingle();
    if (companionSettings?.video_call_enabled === false) {
      return new Response(JSON.stringify({ error: "Video calling is turned off right now" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { data: seniorProfile } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("id", seniorId)
      .single();
    if (!seniorProfile) {
      return new Response(JSON.stringify({ error: "Senior not found" }), {
        status: 404,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const roomName = `silverbeam-${seniorId.slice(0, 8)}-${Date.now()}`;
    const dailyRes = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          exp: Math.floor(Date.now() / 1000) + 60 * 60,
          enable_screenshare: false,
          enable_chat: false,
          enable_people_ui: false,
          enable_network_ui: false,
          enable_prejoin_ui: false,
          start_video_off: false,
          start_audio_off: false,
        },
      }),
    });

    if (!dailyRes.ok) {
      const detail = await dailyRes.text();
      console.error("[create-family-call] Daily room creation failed", detail);
      return new Response(JSON.stringify({ error: "Could not start the call" }), {
        status: 502,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const room = (await dailyRes.json()) as { url: string; name: string };

    const [familyToken, seniorToken] = await Promise.all([
      mintMeetingToken(room.name, profile.full_name),
      mintMeetingToken(room.name, seniorProfile.full_name),
    ]);
    const familyRoomUrl = familyToken ? `${room.url}?t=${familyToken}` : room.url;
    const seniorRoomUrl = seniorToken ? `${room.url}?t=${seniorToken}` : room.url;

    const callerLabel = link.relationship || profile.full_name;

    await serviceClient.from("call_events").insert({
      senior_id: seniorId,
      room_name: room.name,
      target_family_member_id: user.id,
      initiated_by: "family",
      target_room_url: seniorRoomUrl,
      caller_label: callerLabel,
    });

    const { data: tokens, error: tokensError } = await serviceClient
      .from("push_tokens")
      .select("token")
      .eq("profile_id", seniorId);
    if (tokensError) console.error("[create-family-call] push_tokens lookup failed:", tokensError.message);
    for (const t of tokens ?? []) {
      const title = `${callerLabel} is calling`;
      const body = "Tap to answer";
      const data = { kind: "incoming_call", roomUrl: seniorRoomUrl, roomName: room.name, callerLabel };
      await sendExpoPush(t.token, title, body, data, "incoming-calls-v2");
      if (typeof EdgeRuntime !== "undefined") {
        EdgeRuntime.waitUntil(scheduleRepeatPushes(t.token, title, body, data, "incoming-calls-v2"));
      }
    }

    return new Response(JSON.stringify({ roomUrl: familyRoomUrl, roomName: room.name }), {
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
