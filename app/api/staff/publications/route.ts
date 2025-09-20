import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

// ป้องกัน crash เวลาไม่มีค่าตัวเลข
function toInt(s: string | null, def: number | null = null) {
  if (!s) return def;
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}

function applyFilters<T>(q: ReturnType<typeof supabase.from<T>['select']>, params: {
  q?: string;
  type?: string;   // JOURNAL/CONFERENCE/BOOK -> venue.type
  rank?: string;   // NATIONAL/INTERNATIONAL  -> publication.level
  yearFrom?: number | null;
  yearTo?: number | null;
}) {
  const { q: kw, type, rank, yearFrom, yearTo } = params;
  if (kw) q = q.or(`venue_name.ilike.%${kw}%,link_url.ilike.%${kw}%`);
  if (type) q = q.filter('venue.type', 'eq', type);
  if (rank) q = q.eq('level', rank);
  if (yearFrom != null) q = q.gte('year', yearFrom);
  if (yearTo   != null) q = q.lte('year', yearTo);
  return q;
}

async function countWithStatus(baseParams: any, status?: 'draft'|'under_review'|'published'|'archived') {
  let sel = supabase
    .from('publication')
    .select('pub_id, venue:venue_id(type)', { head: true, count: 'exact' });
  sel = applyFilters(sel, baseParams);
  if (status) sel = sel.eq('status', status);
  const { count, error } = await sel;
  if (error) throw error;
  return count ?? 0;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q        = searchParams.get('q')?.trim() || '';
    const type     = searchParams.get('type')?.trim() || '';  // JOURNAL/CONFERENCE/BOOK
    const rank     = searchParams.get('rank')?.trim() || '';  // NATIONAL/INTERNATIONAL
    const yearFrom = toInt(searchParams.get('yearFrom'));
    const yearTo   = toInt(searchParams.get('yearTo'));
    const page     = Math.max(1, toInt(searchParams.get('page'), 1)!);
    const pageSize = Math.min(50, Math.max(1, toInt(searchParams.get('pageSize'), 20)!));
    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    // ---------- list ----------
    let listQuery = supabase
      .from('publication')
      .select('pub_id, venue_name, level, year, status, link_url, venue:venue_id(type)', { count: 'exact' });

    listQuery = applyFilters(listQuery, { q, type, rank, yearFrom, yearTo });
    listQuery = listQuery.order('year', { ascending: false }).range(from, to);

    const { data: pubs, error: lerr, count } = await listQuery;
    if (lerr) throw lerr;

    const rows = (pubs || []).map((p: any) => ({
      pub_id: p.pub_id,
      title: p.title ?? null,
      type: p.venue?.type ?? null,   // JOURNAL/CONFERENCE/BOOK
      rank: p.level ?? null,         // NATIONAL/INTERNATIONAL
      year: p.year ?? null,
      status: p.status ?? null,      // draft/under_review/published/archived
      venue_name: p.venue_name ?? null,
      link_url: p.link_url ?? null,
    }));

    // ---------- counters (ตามตัวกรองปัจจุบัน) ----------
    const base = { q, type, rank, yearFrom, yearTo };
    const [total, draft, under_review, published, archived] = await Promise.all([
      countWithStatus(base),
      countWithStatus(base, 'draft'),
      countWithStatus(base, 'under_review'),
      countWithStatus(base, 'published'),
      countWithStatus(base, 'archived'),
    ]);

    return NextResponse.json({
      data: rows,
      total: count ?? 0,
      counters: { total, draft, under_review, published, archived },
    });
  } catch (err: any) {
    console.error('staff publications api:', err?.message || err);
    return NextResponse.json({ message: err?.message || 'internal error' }, { status: 500 });
  }
}
