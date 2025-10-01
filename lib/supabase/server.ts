// lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/** ใช้เฉพาะฝั่ง Server (App Router handlers / Server Components) */
export async function createSupabaseServer() {
  const cookieStore = await cookies(); // ⬅️ Next.js 15 ต้อง await

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!, // ใช้แค่ฝั่ง server
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options);
          } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, "", { ...options, maxAge: 0 });
          } catch {}
        },
      },
    }
  );
}