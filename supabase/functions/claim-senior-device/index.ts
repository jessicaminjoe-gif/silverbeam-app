// SilverBeam `claim-senior-device` Edge Function
//
// Lets a freshly-anonymous-signed-in device "reconnect" to an existing
// senior's account by ID (shown to family in Settings) instead of always
// creating a brand-new, unlinked profile -- the previous flow meant every
// reinstall orphaned the old profile and needed a manual re-link.
//
// Security note: this only requires knowing the target senior's ID, the
// same tradeoff already accepted by showing that ID in family Settings.
// Fine for a small trusted beta; would need a stronger check (e.g. a PIN,
// or requiring the request to come through a currently-linked family
// member's session) before this could be safe at real-world scale.
//
// Deploy: supabase functions deploy claim-senior-device

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// senior_id-bearing tables to migrate from the old profile to the new one.
// companion_settings.senior_id is its primary key, but a plain UPDATE
// changing a PK value is fine here since newId is guaranteed fresh (no
// existing row to collide with).
const SENIOR_SCOPED_TABLES = [
  "senior_family_links",
  "check_ins",
  "conversation_messages",
  "escalation_events",
  "call_events",
  "companion_settings",
  "shared_media",
] as const;

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

    // Only a brand-new device (no profile row yet) can claim an existing
    // senior identity -- prevents an already-set-up device from merging
    // itself into someone else's account.
    const { data: existingProfile } = await userClient.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (existingProfile) {
      return new Response(JSON.stringify({ error: "This device is already set up" }), {
        status: 409,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { oldSeniorId } = (await req.json().catch(() => ({}))) as { oldSeniorId?: string };
    if (!oldSeniorId) {
      return new Response(JSON.stringify({ error: "oldSeniorId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    if (oldSeniorId === user.id) {
      return new Response(JSON.stringify({ error: "That's already this device's ID" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { data: oldProfile } = await serviceClient
      .from("profiles")
      .select("full_name, avatar_url, role")
      .eq("id", oldSeniorId)
      .maybeSingle();
    if (!oldProfile || oldProfile.role !== "senior") {
      return new Response(JSON.stringify({ error: "No senior account found with that ID" }), {
        status: 404,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { data: newProfile, error: insertError } = await serviceClient
      .from("profiles")
      .insert({ id: user.id, role: "senior", full_name: oldProfile.full_name, avatar_url: oldProfile.avatar_url })
      .select()
      .single();
    if (insertError || !newProfile) {
      console.error("[claim-senior-device] profile insert failed:", insertError?.message);
      return new Response(JSON.stringify({ error: "Could not reconnect this device" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    for (const table of SENIOR_SCOPED_TABLES) {
      const { error: updateError } = await serviceClient
        .from(table)
        .update({ senior_id: user.id })
        .eq("senior_id", oldSeniorId);
      if (updateError) console.error(`[claim-senior-device] migrating ${table} failed:`, updateError.message);
    }

    // Cascade rules only run the other way (auth.users -> profiles), so
    // this just removes the now-empty old profile row -- the orphaned
    // auth.users row underneath is left alone, same as any other
    // never-cleaned-up test account.
    await serviceClient.from("profiles").delete().eq("id", oldSeniorId);

    return new Response(JSON.stringify({ profile: newProfile }), {
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
