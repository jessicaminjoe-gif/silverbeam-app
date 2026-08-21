import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";

// Picks an image and uploads it to the private "shared-media" bucket under
// the target senior's folder, then records it via share-photo (which also
// notifies the senior). Returns true on success, false if the user
// cancelled/denied permission, throws on an actual upload/network failure.
export async function pickAndSharePhoto(seniorId: string): Promise<boolean> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return false;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    base64: true,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset?.base64) return false;

  const ext = asset.mimeType?.split("/")[1] ?? "jpg";
  const path = `${seniorId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("shared-media")
    .upload(path, decode(asset.base64), { contentType: asset.mimeType ?? "image/jpeg" });
  if (uploadError) throw uploadError;

  const { error: shareError } = await supabase.functions.invoke("share-photo", {
    body: { seniorId, storagePath: path },
  });
  if (shareError) throw shareError;

  return true;
}
