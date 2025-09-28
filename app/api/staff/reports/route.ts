// app/api/staff/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import { parseQueryForReport, buildReport } from "./_service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const params = parseQueryForReport(new URL(req.url).searchParams);
    const data = await buildReport(params);
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "failed" },
      { status: 500 }
    );
  }
}