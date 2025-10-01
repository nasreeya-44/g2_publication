// app/api/staff/change-password/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server key
);

const SESSION_SECRET = process.env.SESSION_SECRET!;

export async function POST(req: Request) {
  try {
    // 1) auth จาก cookie
    const token = (await cookies()).get("app_session")?.value;
    if (!token) {
      return NextResponse.json({ ok: false, message: "no session" }, { status: 401 });
    }
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SESSION_SECRET));
    const userId = Number(payload.user_id);
    if (!userId) {
      return NextResponse.json({ ok: false, message: "invalid session" }, { status: 401 });
    }

    // 2) รับ body
    const { current_password, new_password } = await req.json();
    if (!current_password || !new_password) {
      return NextResponse.json({ ok: false, message: "missing fields" }, { status: 400 });
    }
    if (String(new_password).length < 8) {
      return NextResponse.json({ ok: false, message: "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
    }

    // 3) ดึง hash เดิม
    const { data: user, error: selErr } = await supabase
      .from("users")
      .select("user_id, password_hash")
      .eq("user_id", userId)
      .single();

    if (selErr || !user) {
      return NextResponse.json({ ok: false, message: "user not found" }, { status: 404 });
    }

    // 4) ตรวจรหัสเดิม
    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ ok: false, message: "รหัสผ่านเดิมไม่ถูกต้อง" }, { status: 400 });
    }

    // 5) อัปเดตรหัสใหม่ (ไม่แตะ updated_at)
    const newHash = await bcrypt.hash(new_password, 10);
    const { error: updErr } = await supabase
      .from("users")
      .update({ password_hash: newHash }) // << ไม่มี updated_at
      .eq("user_id", userId);

    if (updErr) {
      return NextResponse.json({ ok: false, message: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "server error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";