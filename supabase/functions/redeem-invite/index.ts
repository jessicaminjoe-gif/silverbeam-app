// SilverBeam `redeem-invite` Edge Function
//
// A newly-signed-up family member spends a code from create-invite to link
// themselves to that code's senior, without the founder doing it by hand.
//
// Deploy: supabase functions deploy redeem-invite

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
      return new Response(JSON.stringify({ error: "Only family accounts can redeem an invite" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { code } = (await req.json().catch(() => ({}))) as { code?: string };
    const normalizedCode = code?.trim().toUpperCase();
    if (!normalizedCode) {
      return new Response(JSON.stringify({ error: "code is required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // service role: the redeemer isn't linked to this senior yet, so the
    // family_invites RLS policy (linked family only) wouldn't let them see
    // the row they're trying to spend.
    const { data: invite, error: inviteError } = await serviceClient
      .from("family_invites")
      .select("id, senior_id, relationship, expires_at, used_at")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (inviteError) {
      console.error("[redeem-invite] lookup failed:", inviteError.message);
      return new Response(JSON.stringify({ error: "Could not check that code" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    if (!invite) {
      return new Response(JSON.stringify({ error: "That code wasn't found. Double-check it and try again." }), {
        status: 404,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    if (invite.used_at) {
      return new Response(JSON.stringify({ error: "That code has already been used." }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "That code has expired. Ask for a new one." }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { data: seniorProfile } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("id", invite.senior_id)
      .single();

    // Already linked (e.g. redeemed once, then tapped the same link again)
    // -- treat as success rather than erroring on the unique constraint.
    const { data: existingLink } = await serviceClient
      .from("senior_family_links")
      .select("id")
      .eq("senior_id", invite.senior_id)
      .eq("family_member_id", user.id)
      .maybeSingle();

    if (!existingLink) {
      const { error: linkError } = await serviceClient.from("senior_family_links").insert({
        senior_id: invite.senior_id,
        family_member_id: user.id,
        relationship: invite.relationship,
      });
      if (linkError) {
        console.error("[redeem-invite] link insert failed:", linkError.message);
        return new Response(JSON.stringify({ error: "Could not connect you. Please try again." }), {
          status: 500,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
    }

    await serviceClient.from("family_invites").update({ used_at: new Date().toISOString(), used_by: user.id }).eq("id", invite.id);

    return new Response(JSON.stringify({ seniorId: invite.senior_id, seniorFullName: seniorProfile?.full_name ?? "your family member" }), {
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
