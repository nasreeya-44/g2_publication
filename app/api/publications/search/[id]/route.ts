// app/api/publications/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

type SearchParams = {
  q?: string;
  author?: string;
  type?: string;                // JOURNAL | CONFERENCE | BOOK | OTHER
  year_from?: string;
  year_to?: string;
  has_pdf?: '1' | '0';
  has_student?: '1' | '0';
  categories?: string;          // comma-separated
  page?: string;
  pageSize?: string;
  sort?: 'year_desc' | 'year_asc' | 'updated_desc';
};

/* ---- helper ids ---- */
async function idsByAuthor(author: string) {
  const { data, error } = await supabase
    .from('publication_person')
    .select('pub_id, person:person_id(full_name)')
    .ilike('person.full_name', `%${author}%`);
  if (error) throw error;
  return [...new Set((data || []).map((r: any) => r.pub_id))];
}

async function idsByCategories(cats: string[]) {
  if (cats.length === 0) return [];
  const { data, error } = await supabase
    .from('category_publication')
    .select('pub_id, category:category_id(category_name)')
    .in('category.category_name', cats);
  if (error) throw error;
  return [...new Set((data || []).map((r: any) => r.pub_id))];
}

async function idsHasStudent() {
  const { data, error } = await supabase
    .from('publication_person')
    .select('pub_id, person:person_id(person_type)')
    .eq('person.person_type', 'STUDENT');
  if (error) throw error;
  return [...new Set((data || []).map((r: any) => r.pub_id))];
}

function intersectMany(list: number[][]) {
  if (list.length === 0) return null;
  let set = new Set(list[0]);
  for (let i = 1; i < list.length; i++) {
    const s2 = new Set(list[i]);
    set = new Set([...set].filter((x) => s2.has(x)));
  }
  return [...set];
}

export async function GET(req: NextRequest) {
  try {
    const sp = Object.fromEntries(new URL(req.url).searchParams) as SearchParams;

    const page = Math.max(1, parseInt(sp.page || '1', 10));
    const pageSize = Math.min(50, Math.max(5, parseInt(sp.pageSize || '10', 10)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // ---- pre-filter id sets ----
    const idSets: number[][] = [];

    if (sp.author && sp.author.trim()) {
      const ids = await idsByAuthor(sp.author.trim());
      if (ids.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, pageSize, facets: { categories: [] } });
      }
      idSets.push(ids);
    }

    const categories = (sp.categories || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (categories.length > 0) {
      const ids = await idsByCategories(categories);
      if (ids.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, pageSize, facets: { categories: [] } });
      }
      idSets.push(ids);
    }

    if (sp.has_student === '1') {
      const ids = await idsHasStudent();
      if (ids.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, pageSize, facets: { categories: [] } });
      }
      idSets.push(ids);
    }

    const idsIntersect = intersectMany(idSets);

    // ---- SELECT: ใช้ !inner ถ้ามีการกรอง type ----
    const venueRel = sp.type && sp.type !== 'ALL'
      ? 'venue:venue_id!inner(type)'  // บังคับ INNER JOIN
      : 'venue:venue_id(type)';

    const sel = `
      pub_id, pub_name, year, level, has_pdf, status, link_url, venue_id, venue_name, updated_at,
      ${venueRel},
      authors:publication_person(
        author_order, role,
        person:person_id(full_name, person_type)
      ),
      cats:category_publication(
        category:category_id(category_name)
      )
    `;

    let q1 = supabase
      .from('publication')
      .select(sel, { count: 'exact' })
      .eq('status', 'published');

    // คำค้น
    if (sp.q && sp.q.trim()) {
      const q = sp.q.trim();
      q1 = q1.or(`pub_name.ilike.%${q}%,venue_name.ilike.%${q}%,link_url.ilike.%${q}%`);
    }

    // ประเภท (filter บนความสัมพันธ์)
    if (sp.type && sp.type !== 'ALL') {
      // ใช้ filter ก็ได้ แต่ในทางปฏิบัติ eq/ filter เหมือนกัน
      q1 = q1.eq('venue.type', sp.type);
      // หรือ q1 = q1.filter('venue.type', 'eq', sp.type);
    }

    // ปีช่วง
    if (sp.year_from) q1 = q1.gte('year', Number(sp.year_from));
    if (sp.year_to)   q1 = q1.lte('year', Number(sp.year_to));

    // PDF
    if (sp.has_pdf === '1') q1 = q1.eq('has_pdf', true);
    if (sp.has_pdf === '0') q1 = q1.eq('has_pdf', false);

    // intersect ids
    if (idsIntersect && idsIntersect.length > 0) {
      q1 = q1.in('pub_id', idsIntersect);
    } else if (idsIntersect && idsIntersect.length === 0) {
      return NextResponse.json({ data: [], total: 0, page, pageSize, facets: { categories: [] } });
    }

    // sort
    switch (sp.sort) {
      case 'year_asc':
        q1 = q1.order('year', { ascending: true }).order('pub_id', { ascending: true });
        break;
      case 'updated_desc':
        q1 = q1.order('updated_at', { ascending: false }).order('pub_id', { ascending: false });
        break;
      default:
        q1 = q1.order('year', { ascending: false }).order('pub_id', { ascending: false });
        break;
    }

    // pagination
    q1 = q1.range(from, to);

    const { data, error, count } = await q1;
    if (error) throw error;

    const rows = (data || []).map((r: any) => ({
      pub_id: r.pub_id,
      pub_name: r.pub_name ?? null,
      year: r.year ?? null,
      type: r.venue?.type ?? null,
      level: r.level ?? null,
      has_pdf: !!r.has_pdf,
      status: r.status ?? null,
      link_url: r.link_url ?? null,
      venue_name: r.venue_name ?? null,
      updated_at: r.updated_at ?? null,
      authors: (r.authors || [])
        .sort((a: any, b: any) => (a.author_order ?? 0) - (b.author_order ?? 0))
        .map((a: any) => a.person?.full_name)
        .filter(Boolean),
      categories: (r.cats || [])
        .map((c: any) => c.category?.category_name)
        .filter(Boolean),
    }));

    // facets
    const categoryCount = new Map<string, number>();
    for (const row of rows) for (const c of row.categories || [])
      categoryCount.set(c, (categoryCount.get(c) || 0) + 1);

    const facets = {
      categories: [...categoryCount.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    };

    return NextResponse.json({ data: rows, total: count ?? 0, page, pageSize, facets });
  } catch (e: any) {
    console.error('[search] error:', e);
    return NextResponse.json({ message: e?.message || 'internal error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';