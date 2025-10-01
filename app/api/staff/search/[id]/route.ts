// app/api/staff/search/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ✅ ใช้ Service Role เฉพาะฝั่ง Server เท่านั้น
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export const dynamic = "force-dynamic";

const BUCKET = (process.env.NEXT_PUBLIC_PUBLICATION_BUCKET || "publication_files").replace(
  /^\/+|\/+$/g,
  ""
);

// ===== helpers (ใช้ตอน DELETE) =====
function stripBucketPrefix(path?: string | null) {
  if (!path) return "";
  return path.startsWith(BUCKET + "/") ? path.slice(BUCKET.length + 1) : path;
}
async function safeDeleteByPubId(table: string, pubId: number) {
  try {
    const { error } = await supabase.from(table).delete().eq("pub_id", pubId);
    if (error) {
      // PGRST116 = ไม่มีแถวให้ลบ, ข้ามได้
      if (error.code !== "PGRST116") throw error;
    }
  } catch {
    // บางตารางอาจไม่มีในสคีมาของโปรเจกต์ ข้ามไป
  }
}

/* ------------------------------------------------------------------
 * GET : (ของเดิม)
 * ------------------------------------------------------------------ */
type RawVenue = { type?: string } | { type?: string }[] | null;
type RawAuthor =
  | {
      author_order: number | null;
      role: string | null;
      person: { full_name?: string | null; affiliation?: string | null } | null;
    }
  | null;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) {
    return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("publication")
    .select(`
      pub_id, pub_name, abstract, year, level, status, created_at, updated_at,
      venue_name, has_pdf, file_path, link_url,
      venue:venue(type),
      publication_person(author_order, role, person:person(full_name, affiliation)),
      category_publication(category:category(category_name))
    `)
    .eq("pub_id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, message: "not found" }, { status: 404 });
  }

  const v: RawVenue = (data as any).venue ?? null;
  const venue_type =
    Array.isArray(v) ? v[0]?.type ?? null : (v as { type?: string } | null)?.type ?? null;

  const rawAuthors = ((data as any).publication_person ?? []) as RawAuthor[];
  const authors = rawAuthors
    .map((p) => ({
      order: p?.author_order ?? null,
      role: p?.role ?? null,
      name: p?.person?.full_name ?? "-",
      email: null as string | null,
      affiliation: p?.person?.affiliation ?? null,
    }))
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

  const categories = (((data as any).category_publication ?? []) as Array<{
    category?: { category_name?: string } | null;
  }>)
    .map((c) => c.category?.category_name)
    .filter(Boolean) as string[];

  // พยายามสร้าง signed URL (เผื่อเป็น private)
  let pdf_public_url: string | null = null;
  if ((data as any).file_path) {
    const { data: s } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl((data as any).file_path, 60 * 10);
    pdf_public_url = s?.signedUrl ?? null;
  }

  const payload = {
    pub_id: (data as any).pub_id as number,
    pub_name: ((data as any).pub_name ?? null) as string | null,
    abstract: ((data as any).abstract ?? null) as string | null,
    year: ((data as any).year ?? null) as number | null,
    level: ((data as any).level ?? null) as string | null,
    status: ((data as any).status ?? null) as string | null,
    created_at: (data as any).created_at as string | null,
    updated_at: (data as any).updated_at as string | null,
    venue_name: ((data as any).venue_name ?? null) as string | null,
    venue_type: (venue_type ?? null) as string | null,
    has_pdf: ((data as any).has_pdf ?? null) as boolean | null,
    file_path: ((data as any).file_path ?? null) as string | null,
    link_url: ((data as any).link_url ?? null) as string | null,
    authors,
    categories,
    pdf_public_url,
  };

  return NextResponse.json({ ok: true, data: payload });
}

/* ------------------------------------------------------------------
 * DELETE : ลบงานตีพิมพ์ + ความสัมพันธ์ + ไฟล์ใน Storage
 * ------------------------------------------------------------------ */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) {
    return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });
  }

  // 1) รวบรวม path ที่ต้องลบใน storage
  const toRemove: string[] = [];

  // 1.1 ไฟล์ภายใต้โฟลเดอร์ {pub_id}/
  const { data: listed } = await supabase.storage
    .from(BUCKET)
    .list(`${id}`, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (Array.isArray(listed)) {
    listed.forEach((it) => toRemove.push(`${id}/${it.name}`));
  }

  // 1.2 fallback: จากตาราง review_files (ถ้ามี)
  try {
    const { data: rf } = await supabase
      .from("review_files")
      .select("file_path")
      .eq("pub_id", id);
    if (Array.isArray(rf)) {
      rf.forEach((r: any) => {
        const rel = stripBucketPrefix(r?.file_path);
        if (rel) toRemove.push(rel);
      });
    }
  } catch {
    // ไม่มีตารางนี้ก็ข้าม
  }

  // 1.3 fallback: จาก column publication.file_path (ไฟล์เดียว)
  const { data: pubRow } = await supabase
    .from("publication")
    .select("file_path")
    .eq("pub_id", id)
    .maybeSingle();
  if (pubRow?.file_path) {
    const rel = stripBucketPrefix(pubRow.file_path);
    if (rel) toRemove.push(rel);
  }

  // 2) ลบตารางลูกก่อน (กัน FK)
  await safeDeleteByPubId("review_files", id);
  await safeDeleteByPubId("publication_edit_log", id);
  await safeDeleteByPubId("publication_person", id);
  await safeDeleteByPubId("category_publication", id);
  await safeDeleteByPubId("review_status_history", id);

  // 3) ลบแถวหลัก
  const { error: eDel } = await supabase.from("publication").delete().eq("pub_id", id);
  if (eDel) {
    return NextResponse.json({ ok: false, message: eDel.message }, { status: 400 });
  }

  // 4) ลบไฟล์ใน storage (ไม่ทำให้ทั้งงาน fail หากลบไฟล์บางไฟล์ไม่ผ่าน)
  if (toRemove.length > 0) {
    const uniq = [...new Set(toRemove.filter(Boolean))];
    if (uniq.length > 0) {
      const { error: eRm } = await supabase.storage.from(BUCKET).remove(uniq);
      if (eRm) {
        console.warn("storage.remove error:", eRm);
      }
    }
  }

  return NextResponse.json({ ok: true });
}