// app/api/publications/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE!; // server role key

if (!URL || !SRV) {
  console.warn('[api:publications/:id] Missing Supabase env variables');
}

const supabase = createClient(URL, SRV);

/** สถานะที่ถือว่าเผยแพร่แล้ว (รองรับหลายสะกด) */
function isPublished(status?: string | null) {
  if (!status) return false;
  const s = String(status).toLowerCase();
  return s === 'published' || s === 'approve' || s === 'approved';
}

/**
 * 🚩 Next.js 15: params เป็น Promise ต้อง await ก่อนจึงจะใช้ได้
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;           // ✅ await params ก่อน
    const pubId = Number(id);
    if (!Number.isFinite(pubId)) {
      return NextResponse.json(
        { ok: false, message: 'invalid id' },
        { status: 400 }
      );
    }

    // -- ดึงข้อมูล publication (เลือกฟิลด์ที่ต้องใช้ รวมถึง abstract)
    const { data: p, error: pErr } = await supabase
      .from('publication')
      .select(
        'pub_id, pub_name, abstract, year, level, has_pdf, file_path, status, link_url, venue_id, venue_name, created_at, updated_at'
      )
      .eq('pub_id', pubId)
      .maybeSingle();

    if (pErr) {
      console.error('[detail] publication error:', pErr);
      return NextResponse.json({ ok: false, message: pErr.message }, { status: 500 });
    }
    if (!p) {
      return NextResponse.json({ ok: false, message: 'not found' }, { status: 404 });
    }
    if (!isPublished(p.status)) {
      return NextResponse.json({ ok: false, message: 'not published' }, { status: 404 });
    }

    // -- venue.type
    let venue_type: string | null = null;
    if (p.venue_id) {
      const { data: v, error: vErr } = await supabase
        .from('venue')
        .select('type')
        .eq('venue_id', p.venue_id)
        .maybeSingle();
      if (vErr) console.warn('[detail] venue error:', vErr.message);
      venue_type = v?.type ?? null;
    }

    // -- Authors
    const { data: authorsRows, error: aErr } = await supabase
      .from('publication_person')
      .select(
        'author_order, role, person:person_id(full_name, email, affiliation, person_type)'
      )
      .eq('pub_id', pubId)
      .order('author_order', { ascending: true });

    if (aErr) {
      console.error('[detail] authors error:', aErr);
      return NextResponse.json({ ok: false, message: aErr.message }, { status: 500 });
    }

    const authors = (authorsRows || []).map((r: any) => ({
      name: r.person?.full_name || '',
      email: r.person?.email ?? null,
      affiliation: r.person?.affiliation ?? null,
      order: r.author_order ?? null,
      role: r.role ?? null,
    }));

    // -- Categories
    const { data: catRows, error: cErr } = await supabase
      .from('category_publication')
      .select('category:category_id(category_name)')
      .eq('pub_id', pubId);

    if (cErr) {
      console.error('[detail] categories error:', cErr);
      return NextResponse.json({ ok: false, message: cErr.message }, { status: 500 });
    }

    const categories = (catRows || [])
      .map((r: any) => r.category?.category_name)
      .filter(Boolean);

    // -- Response
    return NextResponse.json({
      ok: true,
      pub_id: p.pub_id,
      pub_name: p.pub_name ?? null,
      abstract: p.abstract ?? null,     // ✅ ส่งบทคัดย่อออกไปด้วย
      level: p.level ?? null,
      year: p.year ?? null,
      has_pdf: !!p.has_pdf,
      file_path: p.file_path ?? null,
      status: p.status ?? null,
      link_url: p.link_url ?? null,
      venue_name: p.venue_name ?? null,
      venue_type,
      created_at: p.created_at ?? null,
      updated_at: p.updated_at ?? null,
      authors,
      categories,
    });
  } catch (e: any) {
    console.error('[api publications/:id] error:', e);
    return NextResponse.json(
      { ok: false, message: e?.message || 'internal error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';