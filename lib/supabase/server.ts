// lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createSupabaseServer() {
  const c = await cookies(); // <- Next 15
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!, // server-only key
    {
      cookies: {
        get(name: string) {
          return c.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          c.set(name, value, options);
        },
        remove(name: string, options: any) {
          c.set(name, "", { ...options, maxAge: 0 });
        },
      },
    }
  );
}