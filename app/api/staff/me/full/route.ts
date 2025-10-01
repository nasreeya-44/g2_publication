import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE!;
const SESSION_SECRET = process.env.SESSION_SECRET!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

type FullUser = {
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  role: string | null;
  status: string | null;
  profile_image: string | null;
};

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = (await cookies()).get("app_session")?.value;
    if (!token) {
      return NextResponse.json({ ok: false, message: "no session" }, { status: 401 });
    }

    // verify JWT -> ได้ user_id
    let userId: number | null = null;
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(SESSION_SECRET));
      if (typeof payload.user_id === "number") userId = payload.user_id;
    } catch {
      return NextResponse.json({ ok: false, message: "invalid session" }, { status: 401 });
    }
    if (!userId) {
      return NextResponse.json({ ok: false, message: "bad session" }, { status: 401 });
    }

    // ดึงข้อมูลแบบครบฟิลด์ (รวม phone, position)
    const { data, error } = await supabase
      .from("users")
      .select(
        "user_id, username, first_name, last_name, email, phone, position, role, status, profile_image"
      )
      .eq("user_id", userId)
      .single<FullUser>();

    if (error || !data) {
      return NextResponse.json({ ok: false, message: "user not found" }, { status: 404 });
    }

    // ส่งกลับใน key `data` ตามที่หน้า client ใช้
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "failed" },
      { status: 500 }
    );
  }
}