// app/api/publications/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!  // server-only key
);

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pubId = Number(params.id);
    if (!Number.isFinite(pubId)) {
      return NextResponse.json({ message: 'Invalid id' }, { status: 400 });
    }

    // 1) ข้อมูลหลักของ publication
    const { data: pub, error: perr } = await supabase
      .from('publication')
      .select(`
        pub_id, link_url, level, year, has_pdf, file_path,
        venue_id, venue_name, status, created_at, updated_at
      `)
      .eq('pub_id', pubId)
      .single();

    if (perr) return NextResponse.json({ message: perr.message }, { status: 404 });
    if (!pub) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    // 2) ผู้เขียนเรียงลำดับ
    const { data: ppl, error: aerr } = await supabase
      .from('publication_person')
      .select('pub_id, author_order, role, person:person_id(full_name, email, affiliation)')
      .eq('pub_id', pubId)
      .order('author_order', { ascending: true });

    if (aerr) throw aerr;

    const authors = (ppl || []).map((r: any) => ({
      name: r.person?.full_name ?? '',
      email: r.person?.email ?? null,
      affiliation: r.person?.affiliation ?? null,
      order: r.author_order ?? null,
      role: r.role ?? null,
    }));

    // 3) หมวดหมู่
    const { data: cps, error: cerr } = await supabase
      .from('category_publication')
      .select('category:category_id(category_name)')
      .eq('pub_id', pubId);

    if (cerr) throw cerr;

    const categories = (cps || [])
      .map((x: any) => x.category?.category_name)
      .filter(Boolean) as string[];

    // 4) ชื่อ venue (ถ้ามีตาราง)
    let venueType: string | null = null;
    if (pub.venue_id) {
      const { data: v, error: verr } = await supabase
        .from('venue')
        .select('type')
        .eq('venue_id', pub.venue_id)
        .single();
      if (!verr && v) venueType = v.type ?? null;
    }

    return NextResponse.json({
      pub_id: pub.pub_id,
      level: pub.level,
      year: pub.year,
      has_pdf: pub.has_pdf,
      file_path: pub.file_path,
      status: pub.status,
      link_url: pub.link_url,
      venue_name: pub.venue_name,
      venue_type: venueType,
      created_at: pub.created_at,
      updated_at: pub.updated_at,
      authors,
      categories,
    });
  } catch (err: any) {
    console.error('publication detail error:', err?.message || err);
    return NextResponse.json({ message: err?.message || 'internal error' }, { status: 500 });
  }
}
