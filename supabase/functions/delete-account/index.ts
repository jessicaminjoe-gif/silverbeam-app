// SilverBeam `delete-account` Edge Function
//
// Permanently deletes the calling person's account and the data tied to it.
// Required by Apple (in-app account deletion) and Google Play (data-safety
// deletion path), and the right thing for a product that holds a family's
// photos and a senior's check-ins.
//
// What goes:
//   * The caller's profile and everything that cascades from it: links to
//     seniors, notes/photos they sent, push tokens, invites they created,
//     (for a senior) their check-ins, chat history, settings, reminders...
//   * Their files in storage: avatar, photos and voice notes they sent.
//   * A senior left with NO linked family afterwards is deleted too, along
//     with their files -- seniors sign in anonymously on the device, so
//     nobody could ever sign in to remove that data later.
// What stays: a senior who still has other family members keeps everything
// except what the deleted person sent.
//
// The caller can only ever delete themselves (identity comes from the JWT).
//
// Deploy: supabase functions deploy delete-account

import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "content-type": "application/json" } });

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Removes every object under "<folder>/" in a bucket. Best effort: storage
// hiccups are logged, not fatal, so they can't leave the person stuck with
// an account they asked to delete.
async function purgeFolder(bucket: string, folder: string) {
  try {
    for (let guard = 0; guard < 50; guard++) {
      const { data, error } = await serviceClient.storage.from(bucket).list(folder, { limit: 1000 });
      if (error || !data?.length) return;
      const paths = data.filter((f) => f.name).map((f) => `${folder}/${f.name}`);
      const { error: removeError } = await serviceClient.storage.from(bucket).remove(paths);
      if (removeError) {
        console.error(`[delete-account] remove from ${bucket}/${folder} failed:`, removeError.message);
        return;
      }
      if (data.length < 1000) return;
    }
  } catch (err) {
    console.error(`[delete-account] purge ${bucket}/${folder} failed:`, err);
  }
}

async function removePaths(bucket: string, paths: string[]) {
  if (!paths.length) return;
  const { error } = await serviceClient.storage.from(bucket).remove(paths);
  if (error) console.error(`[delete-account] remove from ${bucket} failed:`, error.message);
}

// Everything a senior owns in storage is filed under their own id.
async function purgeSeniorFiles(seniorId: string) {
  await Promise.all([
    purgeFolder("shared-media", seniorId),
    purgeFolder("voice-notes", seniorId),
    purgeFolder("avatars", seniorId),
  ]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "Invalid session" }, 401);

    const { data: profile } = await serviceClient.from("profiles").select("role").eq("id", user.id).maybeSingle();

    // Seniors this person is linked to -- checked again after deleting them
    // to see who has been left with no family at all.
    let linkedSeniorIds: string[] = [];

    if (profile?.role === "senior") {
      await purgeSeniorFiles(user.id);
    } else if (profile) {
      const { data: links } = await serviceClient
        .from("senior_family_links")
        .select("senior_id")
        .eq("family_member_id", user.id);
      linkedSeniorIds = (links ?? []).map((l) => l.senior_id as string);

      // Files filed under the seniors' folders that this person sent.
      const [{ data: photos }, { data: notes }] = await Promise.all([
        serviceClient.from("shared_media").select("storage_path").eq("sender_id", user.id),
        serviceClient.from("family_notes").select("audio_path").eq("sender_id", user.id).not("audio_path", "is", null),
      ]);
      await Promise.all([
        removePaths("shared-media", (photos ?? []).map((p) => p.storage_path as string).filter(Boolean)),
        removePaths("voice-notes", (notes ?? []).map((n) => n.audio_path as string).filter(Boolean)),
        purgeFolder("avatars", user.id),
      ]);
    }

    // Deleting the auth user cascades to the profile and all their rows.
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("[delete-account] deleteUser failed:", deleteError.message);
      return json({ error: "Could not delete the account. Please try again." }, 500);
    }

    // A senior with nobody left to look after their account goes too.
    let removedSeniors = 0;
    for (const seniorId of linkedSeniorIds) {
      const { count } = await serviceClient
        .from("senior_family_links")
        .select("id", { count: "exact", head: true })
        .eq("senior_id", seniorId);
      if (count && count > 0) continue;
      await purgeSeniorFiles(seniorId);
      const { error: seniorError } = await serviceClient.auth.admin.deleteUser(seniorId);
      if (seniorError) console.error("[delete-account] deleting orphaned senior failed:", seniorError.message);
      else removedSeniors++;
    }

    return json({ deleted: true, removedSeniors });
  } catch (err) {
    console.error(err);
    return json({ error: "Internal error" }, 500);
  }
});
