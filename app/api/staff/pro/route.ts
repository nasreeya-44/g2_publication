// app/api/staff/pro/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    let query = supabase
      .from("users")
      .select("user_id, username, first_name, last_name, phone, position, status, email, role")
      .eq("role", "PROFESSOR") // ✅ แสดงเฉพาะอาจารย์
      .order("first_name", { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    // filter คำค้น ถ้ามี q
    const filtered = (data || []).filter((u: any) => {
      if (!q) return true;
      const hay = [u.username, u.first_name, u.last_name, u.email].join(" ").toLowerCase();
      return hay.includes(q.toLowerCase());
    });

    return NextResponse.json({ ok: true, data: filtered });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "failed" }, { status: 500 });
  }
}