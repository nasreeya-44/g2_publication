// app/api/staff/reviews/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

// Response shape ที่หน้า /staff/reviews ต้องการ
type Row = {
  id: number;
  title: string;
  type: string;
  level: string;
  year: number | null;
  venue: string | null;
  owner_name: string | null;
  status: string;
  updated_at: string | null;
};

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // คำค้น
    const q = (searchParams.get("q") || "").trim();

    // ✅ รองรับหลายรูปแบบ:
    //  - ?status=under_review&status=needs_revision
    //  - ?status=UNDER_REVIEW,needs_revision
    const rawStatuses = searchParams.getAll("status");             // ได้เป็น array
    const statuses = rawStatuses
      .flatMap(s => s.split(","))                                  // แตกค่าแบบคอมมา
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.toLowerCase());                                  // ให้ตรง enum ใน DB

    // ถ้าไม่ส่งมาเลย ให้ default = ทั้ง under_review และ needs_revision
    const statusesToUse =
      statuses.length > 0 ? statuses : ["under_review", "needs_revision"];

    // base query
    let query = supabase
      .from("publication")
      .select("pub_id, pub_name, year, venue_name, status, updated_at")
      .order("updated_at", { ascending: false });

    // ✅ ใช้ .in สำหรับหลายสถานะ
    if (statusesToUse.length === 1) {
      query = query.eq("status", statusesToUse[0]);
    } else {
      query = query.in("status", statusesToUse);
    }

    // ค้นหาจากชื่อเรื่องหรือ venue
    if (q) {
      query = query.or(`pub_name.ilike.%${q}%,venue_name.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows: Row[] = (data || []).map((r: any) => ({
      id: r.pub_id,
      title: r.pub_name,
      type: "",                  // ยังไม่ใช้
      level: "",                 // ยังไม่ใช้
      year: r.year ?? null,
      venue: r.venue_name ?? null,
      owner_name: null,          // ค่อย join person ภายหลังถ้าต้องการ
      status: String(r.status || "").toUpperCase(), // เพื่อให้ UI ใช้ตัวพิมพ์ใหญ่ได้
      updated_at: r.updated_at ?? null,
    }));

    return NextResponse.json({ ok: true, data: rows });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "failed" },
      { status: 500 }
    );
  }
}