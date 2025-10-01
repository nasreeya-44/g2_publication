// utils/supabase/server.ts
import { createClient } from "@supabase/supabase-js";

export function supabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // ใช้ key ที่มีสิทธิ์เต็ม
  );
}