// app/api/staff/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseQueryForReport, buildReport } from "../reports/_service";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;

    // ใช้ parser เดิมของหน้า reports (รองรับปี/ระดับ/สถานะ/ประเภท/cat/อื่นๆ)
    const params = parseQueryForReport(sp);

    // สร้างสรุปรายงาน (totals / byYear / topAuthors)
    const report = await buildReport(params);

    // นับจำนวนอาจารย์ทั้งหมด (users.role = 'PROFESSOR', status = ACTIVE)
    const { data: profs, error: eProfs } = await supabase
      .from("users")
      .select("user_id, role, status")
      .eq("role", "PROFESSOR")
      .eq("status", "ACTIVE");
    if (eProfs) throw eProfs;

    const totalProfessors = (profs || []).length;

    return NextResponse.json({
      ok: true,
      data: {
        totals: report.totals,
        byYear: report.byYear,
        topAuthors: report.topAuthors,
        totalProfessors,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "failed" },
      { status: 500 }
    );
  }
}