// SilverBeam `create-invite` Edge Function
//
// Generates a short, single-use code an existing family member can share
// (text, email, read aloud) so a new family member can connect themselves
// to the same senior, instead of the founder manually inserting a
// senior_family_links row for every signup.
//
// Deploy: supabase functions deploy create-invite

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CODE_LENGTH = 6;
// Excludes 0/O/1/I/L -- characters that are easily confused when read over
// the phone or typed from memory.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const EXPIRES_IN_DAYS = 7;
const MAX_GENERATION_ATTEMPTS = 5;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
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

    const { data: profile } = await userClient.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "family") {
      return new Response(JSON.stringify({ error: "Only family accounts can invite other family members" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { seniorId, relationship } = (await req.json().catch(() => ({}))) as {
      seniorId?: string;
      relationship?: string;
    };
    if (!seniorId) {
      return new Response(JSON.stringify({ error: "seniorId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Confirm the inviter is actually linked to this senior -- without
    // this, any family account could mint an invite onto a senior they
    // have nothing to do with.
    const { data: link } = await userClient
      .from("senior_family_links")
      .select("family_member_id")
      .eq("senior_id", seniorId)
      .eq("family_member_id", user.id)
      .maybeSingle();
    if (!link) {
      return new Response(JSON.stringify({ error: "Not a linked family member" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const expiresAt = new Date(Date.now() + EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Collisions are astronomically unlikely at 32^6 codes, but the unique
    // constraint means a collision would otherwise surface as an opaque
    // 500 -- a short retry loop makes that a non-issue instead.
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      const code = generateCode();
      const { data: invite, error } = await serviceClient
        .from("family_invites")
        .insert({
          senior_id: seniorId,
          created_by: user.id,
          code,
          relationship: relationship?.trim() || null,
          expires_at: expiresAt,
        })
        .select("code, expires_at")
        .single();

      if (!error && invite) {
        return new Response(JSON.stringify({ code: invite.code, expiresAt: invite.expires_at }), {
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      // Only retry on the unique-code collision; anything else is a real
      // failure worth surfacing immediately.
      if (error && !error.message.includes("duplicate key")) {
        console.error("[create-invite] insert failed:", error.message);
        return new Response(JSON.stringify({ error: "Could not create invite" }), {
          status: 500,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Could not generate a unique code, please try again" }), {
      status: 500,
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
