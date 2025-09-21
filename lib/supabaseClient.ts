// lib/supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE!; // server only

// ใช้ฝั่ง Browser (client)
export function supabaseBrowser(): SupabaseClient {
  return createClient(URL, ANON);
}

// ใช้ฝั่ง Server Route (service role)
export function supabaseService(): SupabaseClient {
  return createClient(URL, SERVICE);
}

/** อัปโหลดรูปโปรไฟล์ขึ้น bucket 'avatars' แล้วคืน public URL */
export async function uploadAvatar(file: File): Promise<string> {
  const supabase = supabaseBrowser();
  const path = `avatars/${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`;
  const { error: upErr } = await supabase.storage.from('avatars').upload(path.replace('avatars/', ''), file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path.replace('avatars/', ''));
  return data.publicUrl;
}