// app/api/staff/categories/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE!;
const supabase = createClient(url, service);

/**
 * PUT /api/staff/categories/:id
 * body รองรับ:
 *  - { category_name?: string, status?: "ACTIVE" | "INACTIVE" }
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id || 0);
  if (!id) {
    return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, any> = {};

  if (typeof body.category_name === "string") {
    const name = body.category_name.trim();
    if (!name) return NextResponse.json({ ok: false, message: "category_name required" }, { status: 400 });
    patch.category_name = name;
  }

  if (typeof body.status === "string") {
    const s = String(body.status).toUpperCase();
    if (s !== "ACTIVE" && s !== "INACTIVE") {
      return NextResponse.json({ ok: false, message: "status must be ACTIVE or INACTIVE" }, { status: 400 });
    }
    patch.status = s;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, message: "nothing to update" }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();

  const { error } = await supabase.from("category").update(patch).eq("category_id", id);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/staff/categories/:id
 * (ถ้ามีตารางเชื่อม category_publication และไม่ได้ตั้ง ON DELETE CASCADE
 *  จะลบแถวในตารางเชื่อมก่อนเพื่อกัน FK error)
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id || 0);
  if (!id) {
    return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });
  }

  // ลบความสัมพันธ์ก่อน (ถ้าตารางนี้ไม่มี FK หรือไม่มีแถว จะไม่มีผล)
  const { error: jerr } = await supabase
    .from("category_publication")
    .delete()
    .eq("category_id", id);
  if (jerr && jerr.code !== "PGRST116") {
    // PGRST116 = no rows found (ไม่ถือเป็น error สำคัญ)
    return NextResponse.json({ ok: false, message: jerr.message }, { status: 500 });
  }

  const { error } = await supabase.from("category").delete().eq("category_id", id);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}