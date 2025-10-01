// lib/supabase/session-user.ts
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import type { SupabaseClient } from "@supabase/supabase-js";

type SessionUser = { user_id: number; first_name?: string | null; last_name?: string | null } | null;

export async function getSessionUser(supabase: SupabaseClient): Promise<SessionUser> {
  try {
    const c = await cookies();
    const token = c.get("app_session")?.value;
    if (!token) return null;

    const secret = process.env.SESSION_SECRET!;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const user_id = Number(payload.user_id);
    if (!user_id) return null;

    // ดึงชื่อจากตาราง users (optional)
    const { data } = await supabase
      .from("users")
      .select("first_name,last_name")
      .eq("user_id", user_id)
      .maybeSingle();

    return { user_id, first_name: data?.first_name ?? null, last_name: data?.last_name ?? null };
  } catch {
    return null;
  }
}