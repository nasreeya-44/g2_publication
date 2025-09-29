// app/api/staff/reports/export/json/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getReportData } from "../../service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;

    // service ของพี่รีเทิร์น { pubs } (ไม่มี facets/total)
    const { pubs } = await getReportData(sp);

    // นับรวมตรงนี้เอง
    const total = Array.isArray(pubs) ? pubs.length : 0;

    return NextResponse.json({ ok: true, pubs, total });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "failed" },
      { status: 500 }
    );
  }
}