// SilverBeam `share-photo` Edge Function
//
// Records a photo a family member already uploaded to the private
// "shared-media" storage bucket, and notifies the senior. Upload itself
// happens client-side directly to Storage (RLS-gated, see migration
// 0009) -- this function only handles the DB row + notification side
// effect, same division of labor as everywhere else in this app.
//
// Deploy: supabase functions deploy share-photo

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sendExpoPush(token: string, title: string, body: string, data: Record<string, unknown>) {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ to: token, title, body, data, sound: "default", priority: "high" }),
  });
  const resBody = await res.text();
  if (!res.ok) console.error("[share-photo] push send failed:", res.status, resBody);
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
      return new Response(JSON.stringify({ error: "Only family accounts can share photos" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { seniorId, storagePath, caption } = (await req.json().catch(() => ({}))) as {
      seniorId?: string;
      storagePath?: string;
      caption?: string;
    };
    if (!seniorId || !storagePath) {
      return new Response(JSON.stringify({ error: "seniorId and storagePath are required" }), {
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

    const { error: insertError } = await userClient
      .from("shared_media")
      .insert({ senior_id: seniorId, sender_id: user.id, storage_path: storagePath, caption: caption ?? null });
    if (insertError) {
      console.error("[share-photo] insert failed:", insertError.message);
      return new Response(JSON.stringify({ error: "Could not save photo" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const senderLabel = link.relationship || profile.full_name;
    const { data: tokens, error: tokensError } = await serviceClient
      .from("push_tokens")
      .select("token")
      .eq("profile_id", seniorId);
    if (tokensError) console.error("[share-photo] push_tokens lookup failed:", tokensError.message);
    for (const t of tokens ?? []) {
      await sendExpoPush(t.token, "New photo", `${senderLabel} sent you new photos!`, { kind: "photo" });
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
