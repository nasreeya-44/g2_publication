// app/api/staff/search/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ✅ ใช้ Service Role เฉพาะฝั่ง Server เท่านั้น
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export const dynamic = "force-dynamic";

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

  // ------- ดึงข้อมูลหลัก + ความสัมพันธ์ (venue, authors, categories) -------
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

  // ------- venue.type อาจเป็น object หรือ array (ป้องกันไว้) -------
  const v: RawVenue = (data as any).venue ?? null;
  const venue_type =
    Array.isArray(v) ? v[0]?.type ?? null : (v as { type?: string } | null)?.type ?? null;

  // ------- authors -> ให้เป็น array ของ object ที่มี name/affiliation/role/order -------
  const rawAuthors = ((data as any).publication_person ?? []) as RawAuthor[];
  const authors = rawAuthors
    .map((p) => ({
      order: p?.author_order ?? null,
      role: p?.role ?? null,
      name: p?.person?.full_name ?? "-",
      email: null as string | null, // ไม่มีในสคีมา -> ให้เป็น null
      affiliation: p?.person?.affiliation ?? null,
    }))
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

  // ------- categories -> array<string> -------
  const categories = (((data as any).category_publication ?? []) as Array<{
    category?: { category_name?: string } | null;
  }>)
    .map((c) => c.category?.category_name)
    .filter(Boolean) as string[];

  // ------- พยายามสร้าง signed URL ถ้ามี file_path (ใช้ได้ทั้ง public/private bucket) -------
  const bucket = (process.env.NEXT_PUBLIC_PUBLICATION_BUCKET || "publication_files").replace(
    /^\/+|\/+$/g,
    ""
  );

  let pdf_public_url: string | null = null;
  if ((data as any).file_path) {
    const trySigned = await supabase.storage
      .from(bucket)
      .createSignedUrl((data as any).file_path, 60 * 10); // 10 นาที
    if (!trySigned.error && trySigned.data?.signedUrl) {
      pdf_public_url = trySigned.data.signedUrl;
    }
  }

  // ------- ส่ง payload ให้ “ตรงกับ type Detail” ฝั่งหน้า UI -------
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
    // เพิ่มช่องเสริมไว้ให้หน้า UI ใช้ ถ้าเป็น private bucket
    pdf_public_url, // string | null
  };

  return NextResponse.json({ ok: true, data: payload });
}