import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // anon key
);

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const pubId = Number(params.id);
  if (!Number.isFinite(pubId)) {
    return NextResponse.json({ ok: false, message: 'invalid id' }, { status: 400 });
  }

  try {
    // ข้อมูลหลัก (เฉพาะ published)
    const { data: pub, error } = await supabase
      .from('publication')
      .select('pub_id, link_url, level, year, has_pdf, file_path, venue_name, status')
      .eq('status', 'published')
      .eq('pub_id', pubId)
      .maybeSingle();

    if (error) throw error;
    if (!pub) return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });

    // ผู้เขียน
    const { data: ppl } = await supabase
      .from('publication_person')
      .select('author_order, role, person:person_id(full_name, email, affiliation)')
      .eq('pub_id', pubId)
      .order('author_order', { ascending: true });

    const authors = (ppl || []).map((r: any) => ({
      name: r.person?.full_name ?? '',
      email: r.person?.email ?? null,
      affiliation: r.person?.affiliation ?? null,
      order: r.author_order ?? null,
      role: r.role ?? null,
    }));

    // หมวดหมู่
    const { data: cps } = await supabase
      .from('category_publication')
      .select('category:category_id(category_name)')
      .eq('pub_id', pubId);

    const categories = (cps || [])
      .map((x: any) => x.category?.category_name as string | undefined)
      .filter(Boolean) as string[];

    return NextResponse.json({
      ok: true,
      pub_id: pub.pub_id,
      level: pub.level,
      year: pub.year,
      has_pdf: pub.has_pdf,
      file_path: pub.file_path,
      link_url: pub.link_url,
      venue_name: pub.venue_name,
      authors,
      categories
    });
  } catch (err: any) {
    console.error('public detail error:', err?.message || err);
    return NextResponse.json({ ok: false, message: err?.message || 'internal error' }, { status: 500 });
  }
}
