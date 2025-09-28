// app/api/staff/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ใช้ service-role (server only)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // ดึง log ล่าสุด (ตัวอย่าง limit 200 รายการ)
    // เนื่องจาก postgrest join alias เขียนยาก/ชอบดีด เลยเลือกดึงทีละชุดแล้ว map
    // 1) ดึงรายการแก้ไขจาก publication_edit_log
    let logQuery = supabase
      .from("publication_edit_log")
      .select("edit_id, edited_at, field_name, old_value, new_value, pub_id, user_id")
      .order("edited_at", { ascending: false })
      .limit(200);

    // filter ช่วงเวลา
    if (from) logQuery = logQuery.gte("edited_at", from);
    if (to) logQuery = logQuery.lte("edited_at", to + "T23:59:59.999");

    const { data: edits, error: e1 } = await logQuery;
    if (e1) throw e1;

    // 2) ดึง publication ชื่อเรื่อง (รวบยอด pub_id)
    const pubIds = Array.from(new Set((edits || []).map((r: any) => r.pub_id))).filter(Boolean);
    let pubMap = new Map<number, string | null>();

    if (pubIds.length) {
      const { data: pubs, error: ePub } = await supabase
        .from("publication")
        .select("pub_id, pub_name")
        .in("pub_id", pubIds);
      if (ePub) throw ePub;
      (pubs || []).forEach((p: any) => pubMap.set(p.pub_id, p.pub_name ?? null));
    }

    // 3) optional: ดึง users (ถ้าต้องการชื่อคนแก้ไข)
    const userIds = Array.from(new Set((edits || []).map((r: any) => r.user_id))).filter(Boolean);
    let userMap = new Map<number, string>();
    if (userIds.length) {
      const { data: users, error: eUser } = await supabase
        .from("users")
        .select("user_id, first_name, last_name, username")
        .in("user_id", userIds);
      if (eUser) throw eUser;
      (users || []).forEach((u: any) => {
        const name = (u.first_name || u.last_name) ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() : (u.username || `user#${u.user_id}`);
        userMap.set(u.user_id, name);
      });
    }

    // 4) ค้นหา q (ฝั่งแอปนี้ทำฝั่งแอปก็ได้ แต่เราทำ filter ฝั่งเซิร์ฟให้ง่าย)
    const filtered = (edits || []).filter((r: any) => {
      if (!q) return true;
      const needle = q.toLowerCase();
      const hay = [
        pubMap.get(r.pub_id) || "",
        r.field_name || "",
        r.old_value || "",
        r.new_value || "",
        userMap.get(r.user_id || 0) || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });

    // 5) shape ข้อมูลกลับไปให้หน้า UI
    const rows = filtered.map((r: any) => ({
      id: r.edit_id,
      when: r.edited_at,
      pub_id: r.pub_id,
      pub_name: pubMap.get(r.pub_id) ?? null,
      user: userMap.get(r.user_id || 0) || "-",
      field: r.field_name,
      old_value: r.old_value ?? null,
      new_value: r.new_value ?? null,
      // ถ้ามี status history แล้วอยากแสดงใน badge สามารถ query เพิ่มเติมและเติมที่นี่ได้
      status_after: null,
    }));

    // การันตีว่า data เป็น array เสมอ
    return NextResponse.json({ ok: true, data: Array.isArray(rows) ? rows : [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "failed" },
      { status: 500 }
    );
  }
}