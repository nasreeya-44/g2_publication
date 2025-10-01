// app/api/staff/profile/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server-only key
);

const SESSION_SECRET = process.env.SESSION_SECRET!;

async function getUserIdFromCookie() {
  const token = (await cookies()).get("app_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(SESSION_SECRET)
    );
    return typeof payload.user_id === "number" ? payload.user_id : null;
  } catch {
    return null;
  }
}

export async function PUT(req: Request) {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const { error } = await supabase
    .from("users")
    .update({
      username: body.username,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone: body.phone,
      position: body.position,
      profile_image: body.profile_image,
    })
    .eq("user_id", userId);

  if (error) {
    console.error("[PUT /api/staff/profile] error:", error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";