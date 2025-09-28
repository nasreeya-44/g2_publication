// app/api/staff/reviews/[id]/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });

  const supabase = await createSupabaseServer();

  // publication + ผู้เขียน (map person)
  const { data: pub, error: ePub } = await supabase
    .from("publication")
    .select(`
      pub_id, pub_name, level, year, status, updated_at, venue_name, link_url, file_path, has_pdf,
      people:publication_person(
        author_order, role,
        person:person_id(full_name, email)
      )
    `)
    .eq("pub_id", id)
    .maybeSingle();

  if (ePub) return NextResponse.json({ ok: false, message: ePub.message }, { status: 500 });
  if (!pub) return NextResponse.json({ ok: false, message: "not found" }, { status: 404 });

  // owner & corresponding (ตาม role ถ้ามี)
  const authors = (pub.people || [])
    .map((p: any) => ({
      order: p.author_order ?? 0,
      role: (p.role || "").toUpperCase(),
      name: p.person?.full_name ?? "-",
      email: p.person?.email ?? null,
    }))
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

  const owner =
    authors.find(a => ["LEAD", "OWNER"].includes(a.role)) ??
    authors[0] ??
    null;

  const corresponding =
    authors.find(a => ["CORRESPONDING"].includes(a.role)) ?? null;

  // ประวัติสถานะ
  const { data: hist, error: eHist } = await supabase
    .from("publication_status_history")
    .select(`
      changed_at, status, note,
      by:users!publication_status_history_changed_by_fkey(first_name,last_name)
    `)
    .eq("pub_id", id)
    .order("changed_at", { ascending: false })
    .limit(20);

  if (eHist) return NextResponse.json({ ok: false, message: eHist.message }, { status: 500 });

  const history = (hist || []).map(h => {
  const byUser = Array.isArray(h.by) ? h.by[0] : h.by;
  return {
    when: h.changed_at,
    action: h.status,
    by: byUser
      ? `${byUser.first_name ?? ""} ${byUser.last_name ?? ""}`.trim()
      : "-",
    note: h.note ?? null,
  };
});

  const payload = {
    id: pub.pub_id,
    title: pub.pub_name,
    type: "PUBLICATION",               // ไม่มีฟิลด์ type ใน schema จึงแสดงคงที่ หรือจะซ่อนไปเลยก็ได้
    level: pub.level,
    year: pub.year,
    venue: pub.venue_name ?? null,
    owner_name: owner?.name ?? null,
    corresponding_email: corresponding?.email ?? null,
    doi_url: pub.link_url ?? null,     // ใช้ link_url เป็น DOI/ลิงก์ภายนอก
    status: String(pub.status).toUpperCase(),
    updated_at: pub.updated_at,
    authors: authors.map(a => ({ order: a.order, name: a.name, role: a.role })),
    history,
    review_files_count: pub.file_path ? 1 : 0, // ในสคีมาเก็บไฟล์ล่าสุดไว้ที่ publication.file_path
  };

  return NextResponse.json({ ok: true, data: payload });
}