// SilverBeam `transcribe-speech` Edge Function
//
// Speech-to-text for the senior's mic button, via OpenAI's Whisper API.
// Client records audio locally (expo-av), base64-encodes it, and sends it
// here rather than bundling any speech-recognition SDK/API key in the app.
// Companion to `synthesize-speech` (text -> audio); this is audio -> text.
//
// Deploy: supabase functions deploy transcribe-speech
// Secrets: supabase secrets set OPENAI_API_KEY=...

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

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

    // Senior-only (not open to family) purely to bound cost — mirrors
    // synthesize-speech, billed per-minute on our OpenAI account.
    const { data: profile } = await userClient.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "senior") {
      return new Response(JSON.stringify({ error: "Only senior accounts can use voice input" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { audioBase64, mimeType } = (await req.json().catch(() => ({}))) as {
      audioBase64?: string;
      mimeType?: string;
    };
    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "audioBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("file", new Blob([audioBytes], { type: mimeType || "audio/m4a" }), "recording.m4a");
    form.append("model", "whisper-1");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });

    if (!whisperRes.ok) {
      const detail = await whisperRes.text();
      console.error("[transcribe-speech] Whisper request failed:", whisperRes.status, detail);
      return new Response(JSON.stringify({ error: "Could not transcribe audio" }), {
        status: 502,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { text } = (await whisperRes.json()) as { text: string };

    return new Response(JSON.stringify({ text }), {
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
