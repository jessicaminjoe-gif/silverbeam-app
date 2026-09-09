// SilverBeam `board-content` Edge Function
//
// Backs the Beam Board's Weather / Headlines / On This Day tiles. These are
// "glance and done" tiles -- real fetched data, not an AI-generated reply --
// so unlike `chat`, this never touches the companion provider/LLM at all.
// Reuses the same fetchers as the daily briefing and Chat's quick prompts.
//
// Deploy: supabase functions deploy board-content

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";
import { fetchWeather, fetchNewsHeadlines, fetchOnThisDayFact } from "../chat/companion/briefing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Tile = "weather" | "headlines" | "onThisDay";

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

    const { tile } = (await req.json().catch(() => ({}))) as { tile?: Tile };
    if (tile !== "weather" && tile !== "headlines" && tile !== "onThisDay") {
      return new Response(JSON.stringify({ error: "tile must be weather, headlines, or onThisDay" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    if (tile === "headlines") {
      const headlines = await fetchNewsHeadlines(3);
      return new Response(JSON.stringify({ items: headlines }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    if (tile === "onThisDay") {
      const fact = await fetchOnThisDayFact();
      return new Response(JSON.stringify({ items: fact ? [fact] : [] }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // weather -- needs the senior's saved ZIP code.
    const { data: settings } = await userClient
      .from("companion_settings")
      .select("location_zip")
      .eq("senior_id", user.id)
      .maybeSingle();
    const weather = await fetchWeather(settings?.location_zip ?? null);
    return new Response(JSON.stringify({ items: weather ? [weather] : [] }), {
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
