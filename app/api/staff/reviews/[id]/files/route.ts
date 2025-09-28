// app/api/staff/reviews/[id]/files/route.ts
import { NextResponse, NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, message: "file is required" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const meId = await getSessionUserId(req as unknown as NextRequest);

  // ของเดิมเหมือนเดิม: อ่านค่าเดิมไว้ log
  const { data: before, error: e0 } = await supabase
    .from("publication")
    .select("file_path")
    .eq("pub_id", id)
    .maybeSingle();
  if (e0) return NextResponse.json({ ok: false, message: e0.message }, { status: 500 });

  // อัปโหลด storage (bucket: publications)
  const path = `${id}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const ab = await file.arrayBuffer();
  const { data: up, error: eUp } = await supabase.storage
    .from("publications")
    .upload(path, ab, { contentType: file.type, upsert: true });
  if (eUp) return NextResponse.json({ ok: false, message: eUp.message }, { status: 500 });

  const { data: pub } = supabase.storage.from("publications").getPublicUrl(up.path);

  // อัปเดตตารางหลัก
  const { error: eUpd } = await supabase
    .from("publication")
    .update({ file_path: up.path, has_pdf: true, updated_at: new Date().toISOString() })
    .eq("pub_id", id);
  if (eUpd) return NextResponse.json({ ok: false, message: eUpd.message }, { status: 500 });

  // เขียน edit log
  await supabase.from("publication_edit_log").insert({
    pub_id: id,
    user_id: meId ?? null,
    field_name: "file_path",
    old_value: before?.file_path ?? null,
    new_value: up.path,
  });

  return NextResponse.json({ ok: true, path: up.path, publicUrl: pub.publicUrl });
}