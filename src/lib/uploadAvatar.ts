import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";

// Returns the new public URL, or null if the user cancelled / denied
// photo-library permission. Throws on upload failure.
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset?.base64) return null;

  // Fixed filename per user (not a fresh UUID each time) so old photos
  // don't pile up in storage — upsert just overwrites it.
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, decode(asset.base64), { contentType: asset.mimeType ?? "image/jpeg", upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-bust: the path is stable across uploads, so a plain public URL
  // would keep serving a cached copy of the old photo after a re-upload.
  return `${data.publicUrl}?t=${Date.now()}`;
}
