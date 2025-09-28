// app/api/staff/change-password/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

function userIdFromCookie(raw?: string) {
  if (!raw) return 2;
  try { const j = JSON.parse(raw); return Number(j.user_id) || 2; } catch { return 2; }
}

export async function POST(req: Request) {
  const { current_password, new_password } = await req.json();

  if (!new_password || String(new_password).length < 8) {
    return NextResponse.json({ ok: false, message: "รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร" }, { status: 400 });
    }

  const raw = (await cookies()).get("app_session")?.value;
  const user_id = userIdFromCookie(raw);

  const { data: u, error } = await supabase
    .from("users")
    .select("password_hash")
    .eq("user_id", user_id)
    .single();

  if (error || !u) {
    return NextResponse.json({ ok: false, message: "ไม่พบผู้ใช้" }, { status: 404 });
  }

  const ok = await bcrypt.compare(current_password || "", u.password_hash || "");
  if (!ok) {
    return NextResponse.json({ ok: false, message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, { status: 400 });
  }

  const hash = await bcrypt.hash(new_password, 10);
  const { error: updErr } = await supabase
    .from("users")
    .update({ password_hash: hash, updated_at: new Date().toISOString() })
    .eq("user_id", user_id);

  if (updErr) {
    return NextResponse.json({ ok: false, message: updErr.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}