import { createClient } from "@supabase/supabase-js";

export const BUCKET = "receipt-images";

export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("ยังไม่ได้ตั้งค่า Supabase ใน .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** แนบ signed URL (1 ชม.) ให้ image_url ซึ่งเก็บเป็น storage path */
export async function signPath(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await admin().storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
