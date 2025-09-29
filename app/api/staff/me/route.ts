// app/api/staff/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const SESSION_SECRET = process.env.SESSION_SECRET!;

type UserRow = {
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  status: string | null;
  profile_image: string | null;
};

function shapeUser(u: UserRow) {
  const name =
    `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ||
    u.username ||
    "ผู้ใช้";
  return {
    id: u.user_id,
    username: u.username ?? "",
    name,
    role: (u.role ?? "STAFF").toUpperCase(),
    status: u.status ?? "ACTIVE",
    avatarUrl: u.profile_image ?? "/avatar.png",
  };
}

export async function GET() {
  const token = (await cookies()).get("app_session")?.value;
  if (!token) {
    return NextResponse.json({ ok: false, message: "no session" }, { status: 401 });
  }

  let userId: number | null = null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SESSION_SECRET));
    if (typeof payload.user_id === "number") userId = payload.user_id;
  } catch {
    return NextResponse.json({ ok: false, message: "invalid session" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("users")
    .select("user_id, username, first_name, last_name, role, status, profile_image,phone, position")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, message: "user not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, user: shapeUser(data as UserRow) });
}

export const dynamic = "force-dynamic";