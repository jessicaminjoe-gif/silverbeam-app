// SilverBeam `synthesize-speech` Edge Function
//
// Turns the AI companion's text reply into spoken audio via OpenAI's TTS
// API, so the senior can hear it instead of only reading it. Called by the
// client right after `chat` returns a reply. Returns base64 audio (not a
// binary Response) so the client can keep using supabase.functions.invoke()
// consistently with every other function.
//
// Deploy: supabase functions deploy synthesize-speech
// Secrets: supabase secrets set OPENAI_API_KEY=...

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// OpenAI's tts-1 preset voices. Whatever the family picked in Settings is
// stored verbatim in companion_settings.voice_id, so this is also the
// source of truth for what's offered there.
const VALID_VOICES = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]);
const DEFAULT_VOICE = "nova";

// Steer these three toward sounding like an older adult via gpt-4o-mini-tts's
// "instructions" param (tts-1 has no style control, just the raw preset
// voice). echo/Walter is deliberately left off this map -- family confirmed
// its default tts-1 delivery already sounds right, so it keeps using tts-1
// unchanged rather than risk a different voice model changing its timbre.
const OLDER_VOICE_INSTRUCTIONS: Record<string, string> = {
  nova: "Speak as a warm, friendly woman in her 70s. Gentle, slightly unhurried pacing, like a loving grandmother catching up with family.",
  shimmer: "Speak as a gentle, soft-spoken woman in her 70s or 80s. Calm and soothing, with an unhurried pace, like a tender grandmother.",
  onyx: "Speak as a steady, calm man in his 70s. Warm and reassuring, with an unhurried pace, like a wise grandfather.",
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
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

    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Restricted to senior + linked-family accounts (not open to any
    // authenticated user) purely to bound cost — this is billed per
    // character on our OpenAI account.
    const { data: profile } = await userClient.from("profiles").select("role").eq("id", user.id).single();
    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { text, voiceId } = (await req.json().catch(() => ({}))) as { text?: string; voiceId?: string };
    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    let voice = voiceId;
    if (!voice && profile.role === "senior") {
      const { data: settings } = await userClient
        .from("companion_settings")
        .select("voice_id")
        .eq("senior_id", user.id)
        .maybeSingle();
      voice = settings?.voice_id ?? undefined;
    }
    if (!voice || !VALID_VOICES.has(voice)) voice = DEFAULT_VOICE;

    const instructions = OLDER_VOICE_INSTRUCTIONS[voice];
    const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: instructions ? "gpt-4o-mini-tts" : "tts-1",
        voice,
        input: text,
        response_format: "mp3",
        ...(instructions ? { instructions } : {}),
      }),
    });

    if (!ttsRes.ok) {
      const detail = await ttsRes.text();
      console.error("[synthesize-speech] OpenAI TTS failed:", ttsRes.status, detail);
      return new Response(JSON.stringify({ error: "Could not generate speech" }), {
        status: 502,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(audioBuffer);

    return new Response(JSON.stringify({ audioBase64 }), {
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
