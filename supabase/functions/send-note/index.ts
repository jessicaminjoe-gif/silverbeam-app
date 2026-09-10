// SilverBeam `send-note` Edge Function
//
// Records a note (typed text, or a short voice recording) from a family
// member to a linked senior and notifies them. One-directional, same
// division of labor as share-photo. A voice note's audio is uploaded
// client-side to the private "voice-notes" bucket first (see migration
// 0020) -- this function downloads it, transcribes it via Whisper, and
// uses the transcript as `body` so every existing render path (Love
// Notes, Updates) needs no branching between typed and spoken notes.
//
// Deploy: supabase functions deploy send-note
// Secrets: supabase secrets set OPENAI_API_KEY=...

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const MAX_NOTE_LENGTH = 500;

async function transcribeAudio(audioBlob: Blob): Promise<string | null> {
  const form = new FormData();
  form.append("file", audioBlob, "voice-note.m4a");
  form.append("model", "whisper-1");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    console.error("[send-note] Whisper transcription failed:", res.status, await res.text());
    return null;
  }
  const { text } = (await res.json()) as { text: string };
  return text?.trim() || null;
}

async function sendExpoPush(token: string, title: string, body: string, data: Record<string, unknown>) {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ to: token, title, body, data, sound: "default", priority: "high" }),
  });
  // See share-photo/create-call for why the body must be consumed, not just
  // awaited for headers -- an unread response body lets the Edge Function's
  // isolate tear down the outbound request before it actually completes.
  const resBody = await res.text();
  if (!res.ok) console.error("[send-note] push send failed:", res.status, resBody);
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
      return new Response(JSON.stringify({ error: "Only family accounts can send notes" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { seniorId, body: noteBody, audioPath } = (await req.json().catch(() => ({}))) as {
      seniorId?: string;
      body?: string;
      audioPath?: string;
    };
    if (!seniorId || (!noteBody?.trim() && !audioPath)) {
      return new Response(JSON.stringify({ error: "seniorId and either body or audioPath are required" }), {
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

    // audioPath must live under the sending senior's own folder -- without
    // this check a family member linked to senior A could pass a storage
    // path that happens to live under senior B's folder.
    if (audioPath && !audioPath.startsWith(`${seniorId}/`)) {
      return new Response(JSON.stringify({ error: "audioPath does not belong to this senior" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    let finalBody = noteBody?.trim() ?? "";
    if (audioPath) {
      const { data: audioFile, error: downloadError } = await serviceClient.storage.from("voice-notes").download(audioPath);
      if (downloadError || !audioFile) {
        console.error("[send-note] audio download failed:", downloadError?.message);
        return new Response(JSON.stringify({ error: "Could not read the voice note" }), {
          status: 500,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      const transcript = await transcribeAudio(audioFile);
      if (!transcript) {
        return new Response(JSON.stringify({ error: "Could not understand the voice note. Please try again." }), {
          status: 502,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      finalBody = transcript;
    }
    if (finalBody.length > MAX_NOTE_LENGTH) {
      return new Response(JSON.stringify({ error: `Note is too long (max ${MAX_NOTE_LENGTH} characters)` }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // service role, not userClient: there's no client-facing INSERT policy
    // on family_notes, same pattern as shared_media.
    const { error: insertError } = await serviceClient
      .from("family_notes")
      .insert({ senior_id: seniorId, sender_id: user.id, body: finalBody, audio_path: audioPath ?? null });
    if (insertError) {
      console.error("[send-note] insert failed:", insertError.message);
      return new Response(JSON.stringify({ error: "Could not send note" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const senderLabel = link.relationship || profile.full_name;
    const { data: tokens, error: tokensError } = await serviceClient
      .from("push_tokens")
      .select("token")
      .eq("profile_id", seniorId);
    if (tokensError) console.error("[send-note] push_tokens lookup failed:", tokensError.message);
    for (const t of tokens ?? []) {
      await sendExpoPush(t.token, `A note from ${senderLabel}`, finalBody, { kind: "note" });
    }

    return new Response(JSON.stringify({ ok: true, body: finalBody }), {
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
