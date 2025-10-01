// app/api/staff/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE!;

type UserRow = {
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  profile_image: string | null;
};

function shape(row: UserRow) {
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return {
    id: row.user_id,
    username: row.username ?? "",
    name: name || row.username || "ผู้ใช้",
    role: row.role ?? "STAFF",
    avatarUrl: row.profile_image ?? null,
  };
}

function parseSession(raw: string) {
  let userId: number | null = null;
  let username: string | null = null;
  try {
    // รองรับคุกกี้แบบ JSON: {"user_id":2,"username":"officer@uni.ac.th"}
    const j = JSON.parse(raw);
    if (typeof j.user_id === "number") userId = j.user_id;
    if (typeof j.username === "string") username = j.username;
  } catch {
    // ไม่ใช่ JSON → ถ้าเลขล้วน = user_id, อื่น ๆ = username
    if (/^\d+$/.test(raw)) userId = Number(raw);
    else username = raw;
  }
  return { userId, username };
}

export async function GET(_req: NextRequest) {
  const c = await cookies();
  const raw = c.get("app_session")?.value;

  const supabase = createClient(url, service);

  let primary: UserRow | null = null;

  if (raw) {
    const { userId, username } = parseSession(raw);

    let q = supabase
      .from("users")
      .select("user_id, username, first_name, last_name, role, profile_image")
      .limit(1);

    if (userId != null && username) {
      q = q.or(`user_id.eq.${userId},username.eq.${username}`);
    } else if (userId != null) {
      q = q.eq("user_id", userId);
    } else if (username) {
      q = q.eq("username", username);
    }

    const { data, error } = await q.maybeSingle();
    if (!error && data) {
      primary = data as UserRow; // ใส่ type ให้ชัดเจน
    }
  }

  // 🔥 Fallback: ถ้าไม่เจอ ให้ใช้ user_id = 2 (STAFF)
  if (!primary) {
    const { data: fb } = await supabase
      .from("users")
      .select("user_id, username, first_name, last_name, role, profile_image")
      .eq("user_id", 2)
      .single();

    if (!fb) {
      // ไม่มี fallback ด้วย → ตอบ 404
      return NextResponse.json(
        { ok: false, user: null, message: "user not found (including fallback)" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, user: shape(fb as UserRow) });
  }

  return NextResponse.json({ ok: true, user: shape(primary) });
}