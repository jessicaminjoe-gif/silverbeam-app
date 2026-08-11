// SilverBeam `create-call` Edge Function
//
// Creates (or reuses) a Daily.co room for a senior's "Call Family" button,
// then notifies the senior's linked family via push with a deep link into
// the same room. The mobile app loads the returned room URL in a WebView
// using Daily's Prebuilt call UI — no native WebRTC UI to build for MVP.
//
// Deploy: supabase functions deploy create-call
// Secrets: supabase secrets set DAILY_API_KEY=...

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY")!;

async function sendExpoPush(token: string, title: string, body: string, data: Record<string, unknown>) {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ to: token, title, body, data, sound: "default", priority: "high" }),
  });
  // Deliberately consuming the body, not just awaiting fetch() for headers —
  // during beta testing, calls to the exact same token with the exact same
  // payload worked fine when sent directly but silently never arrived when
  // sent from inside this function, and started working once this response
  // was actually read. Best guess: the Edge Function's isolate can tear
  // down an in-flight outbound request once the handler returns, if nothing
  // is still waiting on that response's body — reading it here keeps the
  // request alive until Expo's API has actually finished it.
  const resBody = await res.text();
  if (!res.ok) console.error("[create-call] push send failed:", res.status, resBody);
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

    const { data: profile } = await userClient
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "senior") {
      return new Response(JSON.stringify({ error: "Only senior accounts can start a call" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { familyMemberId } = (await req.json().catch(() => ({}))) as { familyMemberId?: string };
    if (!familyMemberId) {
      return new Response(JSON.stringify({ error: "familyMemberId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Confirm this is actually one of the senior's linked family members —
    // without this a client could pass an arbitrary profile id and get a
    // stranger's push token notified.
    const { data: link } = await userClient
      .from("senior_family_links")
      .select("family_member_id")
      .eq("senior_id", user.id)
      .eq("family_member_id", familyMemberId)
      .maybeSingle();
    if (!link) {
      return new Response(JSON.stringify({ error: "Not a linked family member" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Short-lived room, unique per call — simpler than trying to reuse a
    // long-lived room, and Daily auto-expires it.
    const roomName = `silverbeam-${user.id.slice(0, 8)}-${Date.now()}`;
    const dailyRes = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
          enable_screenshare: false,
          enable_chat: false,
          // Trims the tray's "more options" down to essentially nothing —
          // with screenshare/chat already off, these were the only other
          // things it could contain. Applies room-wide (not a per-token
          // property), so both sides get the simpler toolbar.
          enable_people_ui: false,
          enable_network_ui: false,
          start_video_off: false,
          start_audio_off: false,
        },
      }),
    });

    if (!dailyRes.ok) {
      const detail = await dailyRes.text();
      console.error("Daily room creation failed", detail);
      return new Response(JSON.stringify({ error: "Could not start the call" }), {
        status: 502,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const room = (await dailyRes.json()) as { url: string; name: string };

    // Daily Prebuilt shows a "what's your name" screen unless the join is
    // carrying a meeting token with user_name already set — mint one scoped
    // to this room/sender so the senior never has to type their own name.
    const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          room_name: room.name,
          user_name: profile.full_name,
          exp: Math.floor(Date.now() / 1000) + 60 * 60,
          // Sends the senior's WebView to our own custom-scheme URL instead
          // of Daily's built-in "you've left the call" screen when they tap
          // Leave — CallWebView intercepts this scheme and swaps in a
          // native goodbye screen we fully control (size, wording).
          redirect_on_meeting_exit: "silverbeam://call-ended",
        },
      }),
    });
    let seniorRoomUrl = room.url;
    if (tokenRes.ok) {
      const { token } = (await tokenRes.json()) as { token: string };
      seniorRoomUrl = `${room.url}?t=${token}`;
    } else {
      console.error("[create-call] meeting token creation failed:", tokenRes.status, await tokenRes.text());
    }

    await serviceClient
      .from("call_events")
      .insert({ senior_id: user.id, room_name: room.name, target_family_member_id: familyMemberId });

    const { data: tokens, error: tokensError } = await serviceClient
      .from("push_tokens")
      .select("token")
      .eq("profile_id", familyMemberId);
    if (tokensError) console.error("[create-call] push_tokens lookup failed:", tokensError.message);
    for (const t of tokens ?? []) {
      await sendExpoPush(t.token, `${profile.full_name} is calling`, "Tap to join the video call", {
        roomUrl: room.url,
      });
    }

    return new Response(JSON.stringify({ roomUrl: seniorRoomUrl }), {
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
