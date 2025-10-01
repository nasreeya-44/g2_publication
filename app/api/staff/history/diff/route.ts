// app/api/staff/history/diff/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { verifyStaffOrRedirect } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await verifyStaffOrRedirect(await headers());
  const supabase = await createSupabaseServer();

  const { searchParams } = new URL(req.url);
  const pubId = Number(searchParams.get("pub_id"));
  const fromV = Number(searchParams.get("from"));
  const toV = Number(searchParams.get("to"));

  if (!pubId || !fromV || !toV) {
    return NextResponse.json({ ok: false, message: "pub_id/from/to is required" }, { status: 400 });
  }

  // ดึง log ทั้งหมดของ publication นี้เรียงตามเวลา
  const { data, error } = await supabase
    .from("publication_edit_log")
    .select("edit_id, field_name, old_value, new_value, edited_at")
    .eq("pub_id", pubId)
    .order("edited_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  // สร้าง snapshot ณ version ที่กำหนด
  function buildSnapshot(untilVersion: number) {
    const snap: Record<string, string | null> = {};
    (data || []).slice(0, untilVersion).forEach((r: any) => {
      snap[r.field_name] = r.new_value;
    });
    return snap;
  }

  const left = buildSnapshot(fromV);
  const right = buildSnapshot(toV);

  // ฟิลด์ที่เกี่ยวข้องทั้งหมด
  const fieldSet = new Set<string>([
    ...Object.keys(left),
    ...Object.keys(right),
  ]);

  const rows = [...fieldSet].sort().map((f) => ({
    field: f,
    old: left[f] ?? null,
    next: right[f] ?? null,
    changed: (left[f] ?? null) !== (right[f] ?? null),
  }));

  return NextResponse.json({ ok: true, data: { rows } });
}