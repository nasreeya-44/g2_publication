// app/api/staff/reviews/[id]/files/route.ts
import { NextResponse, NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ใช้ชื่อบักเก็ตจาก ENV ถ้าไม่ตั้งจะ fallback เป็น publication_files
const BUCKET = process.env.NEXT_PUBLIC_PUB_BUCKET ?? "publication_files";

// helper: เผื่อ file_path ใน DB เก็บมาพร้อม prefix ชื่อบักเก็ต เช่น "publication_files/123/a.pdf"
// ให้ตัด prefix ออก เหลือ path relative ต่อบักเก็ต
function normalizePath(p?: string | null) {
  if (!p) return "";
  return p.startsWith(BUCKET + "/") ? p.slice(BUCKET.length + 1) : p;
}

// helper: แปลง path -> URL (รองรับทั้ง public/private bucket)
async function toPublicOrSigned(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  relPath: string
) {
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(relPath);
  if (pub?.publicUrl) return pub.publicUrl;
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(relPath, 60 * 60);
  return signed?.signedUrl ?? "";
}

/* ================================
   POST: อัปโหลดไฟล์ PDF เข้า storage
   ================================ */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, message: "file is required" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const meId = await getSessionUserId(req as unknown as NextRequest);

  // เก็บค่าเดิมไว้ log
  const { data: before, error: e0 } = await supabase
    .from("publication")
    .select("file_path")
    .eq("pub_id", id)
    .maybeSingle();
  if (e0) return NextResponse.json({ ok: false, message: e0.message }, { status: 500 });

  // อัปโหลด (bucket: BUCKET)
  const path = `${id}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const ab = await file.arrayBuffer();
  const { data: up, error: eUp } = await supabase.storage
    .from(BUCKET)
    .upload(path, ab, { contentType: file.type, upsert: true });
  if (eUp) return NextResponse.json({ ok: false, message: eUp.message }, { status: 500 });

  const publicUrl = await toPublicOrSigned(supabase, up.path);

  // อัปเดตตารางหลัก (เก็บ path แบบ relative ต่อบักเก็ต)
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

  return NextResponse.json({ ok: true, path: up.path, publicUrl });
}

/* ================================
   GET: คืนลิสต์ไฟล์ที่แนบมา (อ่านอย่างเดียว)
   ================================ */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });

  const supabase = await createSupabaseServer();

  // 1) ลอง list ไฟล์ในโฟลเดอร์ {id}/
  const { data: listed, error: eList } = await supabase.storage
    .from(BUCKET)
    .list(`${id}`, { limit: 100, sortBy: { column: "name", order: "asc" } });

  // ถ้ามีไฟล์ในโฟลเดอร์ -> ใช้ลิสต์นี้
  if (!eList && listed && listed.length > 0) {
    const files = await Promise.all(
      listed.map(async (it) => {
        const relPath = `${id}/${it.name}`;
        const url = await toPublicOrSigned(supabase, relPath);
        return {
          name: it.name,
          url,
          uploaded_at: (it as any).created_at ?? (it as any).updated_at ?? null,
        };
      })
    );
    return NextResponse.json({ ok: true, data: files });
  }

  // 2) Fallback A: ตาราง review_files (ถ้ามี)
  try {
    const { data: rf, error: eRf } = await supabase
      .from("review_files")
      .select("file_path, file_name, created_at")
      .eq("pub_id", id)
      .order("created_at", { ascending: true });

    if (!eRf && Array.isArray(rf) && rf.length > 0) {
      const files = await Promise.all(
        rf.map(async (r) => {
          const rel = normalizePath(r.file_path);
          const url = await toPublicOrSigned(supabase, rel);
          return {
            name: r.file_name ?? rel.split("/").pop() ?? "ไฟล์แนบ",
            url,
            uploaded_at: r.created_at ?? null,
          };
        })
      );
      return NextResponse.json({ ok: true, data: files });
    }
  } catch {
    // ignore แล้วไป fallback ต่อ
  }

  // 3) Fallback B: column publication.file_path (ไฟล์เดียว)
  const { data: pub, error: ePub } = await supabase
    .from("publication")
    .select("file_path, updated_at")
    .eq("pub_id", id)
    .maybeSingle();

  if (ePub) return NextResponse.json({ ok: false, message: ePub.message }, { status: 500 });

  const rel = normalizePath(pub?.file_path);
  if (!rel) return NextResponse.json({ ok: true, data: [] });

  const url = await toPublicOrSigned(supabase, rel);
  const one = [{ name: rel.split("/").pop() ?? "ไฟล์แนบ", url, uploaded_at: pub?.updated_at ?? null }];
  return NextResponse.json({ ok: true, data: one });
}
