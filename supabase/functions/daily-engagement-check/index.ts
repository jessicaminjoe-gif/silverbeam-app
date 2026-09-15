// SilverBeam `daily-engagement-check` Edge Function
//
// The first scheduled (not user-triggered) work in this app — invoked once
// a day by a pg_cron job (see migration 0022_engagement_check.sql), not by
// a client. Does two independent things in one run, sharing the same
// schedule since both are daily engagement signals:
//
// 1. Inactivity alert: if a senior has gone longer than their
//    family-configured threshold without a check-in, push every linked
//    family member.
// 2. Re-engagement nudge: if an individual family member hasn't reached out
//    (call, photo, or note) to their linked senior in 7 days, push just
//    that person.
//
// Both track their own "last sent" timestamp so a standing condition
// doesn't re-alert every single day once triggered.
//
// Deploy: supabase functions deploy daily-engagement-check

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REENGAGEMENT_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function sendExpoPush(token: string, title: string, body: string) {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ to: token, title, body, sound: "default", priority: "high" }),
  });
  // See chat/create-call for why the body must be consumed, not just awaited.
  const resBody = await res.text();
  if (!res.ok) console.error("[daily-engagement-check] push send failed:", res.status, resBody);
}

function daysSince(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / MS_PER_DAY;
}

Deno.serve(async (req) => {
  // Not a user-facing endpoint -- only the cron job (or an operator running
  // it manually with the service role key) should ever trigger this.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = Date.now();
  const results = { inactivityAlertsSent: 0, reengagementNudgesSent: 0 };

  try {
    // ------------------------------------------------------------------
    // 1. Inactivity alerts
    // ------------------------------------------------------------------
    const { data: settingsRows } = await serviceClient
      .from("companion_settings")
      .select("senior_id, inactivity_alert_days, last_inactivity_alert_sent_at")
      .not("inactivity_alert_days", "is", null);

    for (const settings of settingsRows ?? []) {
      const thresholdDays = settings.inactivity_alert_days as number;

      if (settings.last_inactivity_alert_sent_at && daysSince(settings.last_inactivity_alert_sent_at, now) < thresholdDays) {
        continue; // Already alerted within this window -- don't repeat daily.
      }

      const { data: lastCheckIn } = await serviceClient
        .from("check_ins")
        .select("occurred_at")
        .eq("senior_id", settings.senior_id)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // No check-in on record at all yet -- nothing to measure inactivity
      // against, so skip rather than alert on day one.
      if (!lastCheckIn) continue;
      if (daysSince(lastCheckIn.occurred_at, now) < thresholdDays) continue;

      const { data: senior } = await serviceClient.from("profiles").select("full_name").eq("id", settings.senior_id).single();
      const { data: links } = await serviceClient
        .from("senior_family_links")
        .select("family_member_id")
        .eq("senior_id", settings.senior_id);
      if (!links?.length) continue;

      const { data: tokens } = await serviceClient
        .from("push_tokens")
        .select("token")
        .in(
          "profile_id",
          links.map((l) => l.family_member_id)
        );

      const title = `Checking in on ${senior?.full_name ?? "your senior"}`;
      const body = `No check-in from ${senior?.full_name ?? "them"} in ${thresholdDays}+ days.`;
      for (const t of tokens ?? []) {
        await sendExpoPush(t.token, title, body);
      }

      await serviceClient
        .from("companion_settings")
        .update({ last_inactivity_alert_sent_at: new Date(now).toISOString() })
        .eq("senior_id", settings.senior_id);
      results.inactivityAlertsSent++;
    }

    // ------------------------------------------------------------------
    // 2. Re-engagement nudges
    // ------------------------------------------------------------------
    const { data: links } = await serviceClient
      .from("senior_family_links")
      .select("senior_id, family_member_id, last_reengagement_nudge_sent_at");

    for (const link of links ?? []) {
      if (link.last_reengagement_nudge_sent_at && daysSince(link.last_reengagement_nudge_sent_at, now) < REENGAGEMENT_WINDOW_DAYS) {
        continue; // Already nudged within this window.
      }

      const [{ data: call }, { data: photo }, { data: note }] = await Promise.all([
        serviceClient
          .from("call_events")
          .select("started_at")
          .eq("senior_id", link.senior_id)
          .eq("target_family_member_id", link.family_member_id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        serviceClient
          .from("shared_media")
          .select("created_at")
          .eq("senior_id", link.senior_id)
          .eq("sender_id", link.family_member_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        serviceClient
          .from("family_notes")
          .select("created_at")
          .eq("senior_id", link.senior_id)
          .eq("sender_id", link.family_member_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const activityDates = [call?.started_at, photo?.created_at, note?.created_at].filter((d): d is string => Boolean(d));
      const mostRecent = activityDates.length ? activityDates.reduce((a, b) => (a > b ? a : b)) : null;

      if (mostRecent && daysSince(mostRecent, now) < REENGAGEMENT_WINDOW_DAYS) continue;

      const { data: tokens } = await serviceClient.from("push_tokens").select("token").eq("profile_id", link.family_member_id);
      if (!tokens?.length) continue;

      const { data: senior } = await serviceClient.from("profiles").select("full_name").eq("id", link.senior_id).single();
      const title = "Stay connected";
      const body = `Send ${senior?.full_name ?? "your senior"} a photo or note?`;
      for (const t of tokens) {
        await sendExpoPush(t.token, title, body);
      }

      await serviceClient
        .from("senior_family_links")
        .update({ last_reengagement_nudge_sent_at: new Date(now).toISOString() })
        .eq("senior_id", link.senior_id)
        .eq("family_member_id", link.family_member_id);
      results.reengagementNudgesSent++;
    }

    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[daily-engagement-check]", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
