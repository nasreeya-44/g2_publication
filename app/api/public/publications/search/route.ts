import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // ใช้ anon key สำหรับ public
);

type PubRow = {
  pub_id: number;
  year: number | null;
  has_pdf: boolean | null;
  level: string | null;         // NATIONAL/INTERNATIONAL
  venue_name: string | null;
  link_url: string | null;
  title?: string | null;
  status: string | null;        // enum ใน DB (คาดว่า lowercase)
};

function toInt(s: string | null, def: number | null = null) {
  if (!s) return def;
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q        = searchParams.get('q')?.trim() || '';
    const level    = searchParams.get('level')?.trim() || ''; // NATIONAL/INTERNATIONAL
    const type     = searchParams.get('type')?.trim() || '';  // ถ้าต้องใช้ให้ join venue เพิ่มภายหลัง
    const hasPdf   = searchParams.get('hasPdf') === '1';
    const yearFrom = toInt(searchParams.get('yearFrom'));
    const yearTo   = toInt(searchParams.get('yearTo'));
    const page     = Math.max(1, toInt(searchParams.get('page'), 1)!);
    const pageSize = Math.min(50, Math.max(1, toInt(searchParams.get('pageSize'), 10)!));
    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    // เฉพาะที่เผยแพร่แล้วเท่านั้น
    let qpub = supabase
      .from('publication')
      .select('pub_id, year, has_pdf, level, venue_name, link_url, status', { count: 'exact' })
      .eq('status', 'published');

    if (q)       qpub = qpub.or(`venue_name.ilike.%${q}%,link_url.ilike.%${q}%`);
    if (level)   qpub = qpub.eq('level', level);
    if (hasPdf)  qpub = qpub.eq('has_pdf', true);
    if (yearFrom != null) qpub = qpub.gte('year', yearFrom);
    if (yearTo   != null) qpub = qpub.lte('year', yearTo);

    // (ถ้าต้องกรองตามประเภท JOURNAL/CONFERENCE/BOOK จริง ๆ ให้ join venue:venue_id(type) แล้ว filter 'type')

    qpub = qpub.order('year', { ascending: false }).range(from, to);

    const { data, error, count } = await qpub;
    if (error) throw error;

    return NextResponse.json({
      data: (data as PubRow[] || []).map(p => ({
        pub_id: p.pub_id,
        title: (p as any).title ?? null,
        venue_name: p.venue_name,
        level: p.level,
        year: p.year,
        has_pdf: p.has_pdf,
        link_url: p.link_url
      })),
      total: count ?? 0
    });
  } catch (err: any) {
    console.error('public search error:', err?.message || err);
    return NextResponse.json({ message: err?.message || 'internal error' }, { status: 500 });
  }
}
