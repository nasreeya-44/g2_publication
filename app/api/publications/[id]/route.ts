// app/api/publications/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server-only key
);

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const pubId = Number(params.id);
  if (!Number.isFinite(pubId)) {
    return NextResponse.json({ ok: false, message: 'Invalid id', id: params.id }, { status: 400 });
  }

  try {
    // ---------- 1) ข้อมูลหลัก ----------
    const { data: pub, error: perr } = await supabase
      .from('publication')
      .select(`
        pub_id, link_url, level, year, has_pdf, file_path,
        venue_id, venue_name, status, created_at, updated_at
      `)
      .eq('pub_id', pubId)
      .maybeSingle(); // ใช้ maybeSingle เพื่อลดเคส throw 406

    if (perr) {
      console.error('publication select error:', perr);
      return NextResponse.json({ ok: false, message: perr.message }, { status: 500 });
    }
    if (!pub) {
      // ไม่พบข้อมูล
      return NextResponse.json({ ok: false, message: 'Not found', pub_id: pubId }, { status: 404 });
    }

    // ---------- 2) ผู้เขียน ----------
    let authors: { name: string; email: string | null; affiliation: string | null; order: number | null; role: string | null }[] = [];
    {
      const { data: ppl, error: aerr } = await supabase
        .from('publication_person')
        .select('pub_id, author_order, role, person:person_id(full_name, email, affiliation)')
        .eq('pub_id', pubId)
        .order('author_order', { ascending: true });

      if (aerr) {
        console.warn('authors join error:', aerr.message);
      } else {
        authors = (ppl ?? []).map((r: any) => ({
          name: r.person?.full_name ?? '',
          email: r.person?.email ?? null,
          affiliation: r.person?.affiliation ?? null,
          order: r.author_order ?? null,
          role: r.role ?? null,
        }));
      }
    }

    // ---------- 3) หมวดหมู่ ----------
    let categories: string[] = [];
    {
      const { data: cps, error: cerr } = await supabase
        .from('category_publication')
        .select('category:category_id(category_name)')
        .eq('pub_id', pubId);

      if (cerr) {
        console.warn('categories join error:', cerr.message);
      } else {
        categories = (cps ?? [])
          .map((x: any) => x.category?.category_name as string | undefined)
          .filter(Boolean) as string[];
      }
    }

    // ---------- 4) Venue type (ถ้ามี) ----------
    let venueType: string | null = null;
    if (pub.venue_id) {
      const { data: v, error: verr } = await supabase
        .from('venue')
        .select('type')
        .eq('venue_id', pub.venue_id)
        .maybeSingle();
      if (!verr && v) venueType = v.type ?? null;
    }

    // ---------- 5) ส่งกลับ ----------
    return NextResponse.json({
      ok: true,
      pub_id: pub.pub_id,
      level: pub.level,
      year: pub.year,
      has_pdf: pub.has_pdf,
      file_path: pub.file_path,
      status: pub.status,        // (enum ใน DB อาจเป็นตัวเล็ก เช่น draft/published)
      link_url: pub.link_url,
      venue_name: pub.venue_name,
      venue_type: venueType,
      created_at: pub.created_at,
      updated_at: pub.updated_at,
      authors,
      categories,
    });
  } catch (err: any) {
    console.error('publication detail fatal:', err?.message || err);
    return NextResponse.json({ ok: false, message: err?.message || 'internal error' }, { status: 500 });
  }
}
