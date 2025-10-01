// app/api/staff/reviews/[id]/action/route.ts
import { NextResponse, NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/auth";

type Body = { action: "approve" | "request" | "draft"; note?: string };

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) {
    return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "invalid json" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const meId = await getSessionUserId(req);
  if (!meId) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  // mapping สถานะตามที่ต้องการ
  const statusMap: Record<Body["action"], string> = {
    approve: "published",
    request: "needs_revision", // 👈 ส่งคืนเพื่อแก้ไข
    draft:   "draft",
  };
  const newStatus = statusMap[body.action];

  try {
    // อัปเดตสถานะงาน
    const { error: eUpd } = await supabase
      .from("publication")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("pub_id", id);

    if (eUpd) {
      return NextResponse.json({ ok: false, message: eUpd.message }, { status: 500 });
    }

    // บันทึก history สถานะ
    const { error: eHist } = await supabase.from("publication_status_history").insert({
      pub_id: id,
      status: newStatus,
      note: body.note ?? null,
      changed_by: meId,
      user_id: meId,
    });
    if (eHist) {
      return NextResponse.json({ ok: false, message: eHist.message }, { status: 500 });
    }

    // Log action ของผู้รีวิว (ไม่กระทบ flow ถ้า fail)
    await supabase.from("review_action").insert({
      pub_id: id,
      user_id: meId,
      reviewer_user_id: meId,
      action: body.action,
      comment: body.note ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "internal error" }, { status: 500 });
  }
}