// app/api/publications/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/** --- Supabase (service role) --- */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

/** --- Types --- */
type SearchParams = {
  q?: string;
  scope?: 'ALL' | 'TITLE' | 'AUTHOR' | 'KEYWORD';
  author?: string;
  type?: 'JOURNAL' | 'CONFERENCE' | 'BOOK' | 'OTHER' | 'ALL';
  year_from?: string;
  year_to?: string;
  has_pdf?: '1' | '0';
  has_student?: '1' | '0';
  categories?: string;
  page?: string;
  pageSize?: string;
  sort?: 'year_desc' | 'year_asc' | 'updated_desc';
};

/** --- Utilities --- */
function toInt(v: string | null | undefined, fallback: number) {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** ดึง pub_id ที่ตรงชื่อผู้เขียน (ilike) */
async function idsByAuthorLike(author: string) {
  const { data, error } = await supabase
    .from('publication_person')
    .select('pub_id, person:person_id(full_name)')
    .not('pub_id', 'is', null);

  if (error) throw error;

  const want = author.toLowerCase();
  const out = new Set<number>();
  (data || []).forEach((r: any) => {
    const full_name = (r.person?.full_name || '').toLowerCase();
    if (full_name.includes(want)) out.add(r.pub_id);
  });
  return [...out];
}

/** ดึง pub_id ที่มี category อยู่ในรายการ */
async function idsByCategories(cats: string[]) {
  if (cats.length === 0) return [];
  const want = new Set(cats.map((x) => x.toLowerCase()));

  const { data, error } = await supabase
    .from('category_publication')
    .select('pub_id, category:category_id(category_name)')
    .not('pub_id', 'is', null);

  if (error) throw error;

  const out = new Set<number>();
  (data || []).forEach((r: any) => {
    const cname = String(r.category?.category_name || '').toLowerCase();
    if (want.has(cname)) out.add(r.pub_id);
  });
  return [...out];
}

/** ดึง pub_id ที่มีนักศึกษาร่วม (person_type = STUDENT) */
async function idsHasStudent() {
  const { data, error } = await supabase
    .from('publication_person')
    .select('pub_id, person:person_id(person_type)')
    .not('pub_id', 'is', null);
  if (error) throw error;

  const out = new Set<number>();
  (data || []).forEach((r: any) => {
    const t = String(r.person?.person_type || '').toUpperCase();
    if (t === 'STUDENT') out.add(r.pub_id);
  });
  return [...out];
}

/** intersect หลายชุด id */
function intersectMany(list: number[][]) {
  if (list.length === 0) return null;
  list.sort((a, b) => a.length - b.length);
  let set = new Set(list[0]);
  for (let i = 1; i < list.length; i++) {
    const s2 = new Set(list[i]);
    set = new Set([...set].filter((x) => s2.has(x)));
    if (set.size === 0) break;
  }
  return [...set];
}

/** --- เลือกคอลัมน์สำหรับ select (สลับ !inner เมื่อมีการกรองประเภท) --- */
function buildSelect(hasTypeFilter: boolean) {
  const venue = `venue:venue_id${hasTypeFilter ? '!inner' : ''}(type)`;
  return `
    pub_id, pub_name, year, level, has_pdf, status, link_url, venue_id, venue_name, updated_at,
    ${venue},
    authors:publication_person(
      author_order, role,
      person:person_id(full_name, person_type)
    ),
    cats:category_publication(
      category:category_id(category_name)
    )
  `;
}

/** --- Handler --- */
export async function GET(req: NextRequest) {
  try {
    const sp = Object.fromEntries(new URL(req.url).searchParams) as SearchParams;

    const page = Math.max(1, toInt(sp.page, 1));
    const pageSize = Math.min(50, Math.max(5, toInt(sp.pageSize, 10)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const q = (sp.q || '').trim();
    const scope = (sp.scope || 'ALL').toUpperCase() as SearchParams['scope'];
    const type = (sp.type || 'ALL').toUpperCase() as SearchParams['type'];
    const hasTypeFilter = !!type && type !== 'ALL';

    const categories = (sp.categories || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // ============ pub_id restrictions (intersect) ============
    const idSets: number[][] = [];

    // 1) ผู้เขียน
    if ((q && scope === 'AUTHOR') || (sp.author && sp.author.trim())) {
      const key = scope === 'AUTHOR' ? q : sp.author!.trim();
      const ids = await idsByAuthorLike(key);
      if (ids.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, pageSize, facets: { categories: [] } });
      }
      idSets.push(ids);
    }

    // 2) categories
    if (categories.length > 0) {
      const ids = await idsByCategories(categories);
      if (ids.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, pageSize, facets: { categories: [] } });
      }
      idSets.push(ids);
    }

    // 3) has_student
    if (sp.has_student === '1') {
      const ids = await idsHasStudent();
      if (ids.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, pageSize, facets: { categories: [] } });
      }
      idSets.push(ids);
    }

    const idsIntersect = intersectMany(idSets);

    // ============ main query ============
    const sel = buildSelect(hasTypeFilter);

    let q1 = supabase
      .from('publication')
      .select(sel, { count: 'exact' })
      .eq('status', 'published'); // ปรับตาม enum ของคุณ

    // คีย์เวิร์ด (เว้น AUTHOR เพราะจัดการไปแล้วด้านบน)
    if (q && scope !== 'AUTHOR') {
      if (scope === 'TITLE') {
        q1 = q1.ilike('pub_name', `%${q}%`);
      } else {
        // ALL / KEYWORD → ค้นหลายฟิลด์
        q1 = q1.or(
          `pub_name.ilike.%${q}%,venue_name.ilike.%${q}%,link_url.ilike.%${q}%`
        );
      }
    }

    // ids intersect
    if (idsIntersect && idsIntersect.length > 0) {
      q1 = q1.in('pub_id', idsIntersect);
    } else if (idsIntersect && idsIntersect.length === 0) {
      return NextResponse.json({ data: [], total: 0, page, pageSize, facets: { categories: [] } });
    }

    // ประเภท (ต้องใช้ !inner ใน select ด้านบนเมื่อ hasTypeFilter=true)
    if (hasTypeFilter) {
      q1 = q1.eq('venue.type', type);
    }

    // ปี
    if (sp.year_from) q1 = q1.gte('year', Number(sp.year_from));
    if (sp.year_to) q1 = q1.lte('year', Number(sp.year_to));

    // ไฟล์ PDF
    if (sp.has_pdf === '1') q1 = q1.eq('has_pdf', true);
    if (sp.has_pdf === '0') q1 = q1.eq('has_pdf', false);

    // Sorting
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

    // Pagination
    q1 = q1.range(from, to);

    const { data, error, count } = await q1;
    if (error) throw error;

    // ============ Map rows สำหรับ UI ============
    const rows = (data || []).map((r: any) => {
      const authors = (r.authors || [])
        .sort((a: any, b: any) => (a.author_order ?? 0) - (b.author_order ?? 0));

      const categoriesOut = (r.cats || [])
        .map((c: any) => c.category?.category_name)
        .filter(Boolean);

      const hasStudentRow = authors.some(
        (a: any) => String(a.person?.person_type || '').toUpperCase() === 'STUDENT'
      );

      return {
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
        authors: authors.map((a: any) => a.person?.full_name).filter(Boolean),
        categories: categoriesOut,
        has_student: hasStudentRow,
      };
    });

    // Facets (categories)
    const catCount = new Map<string, number>();
    for (const r of rows) {
      for (const c of r.categories || []) {
        catCount.set(c, (catCount.get(c) || 0) + 1);
      }
    }
    const facets = {
      categories: [...catCount.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    };

    return NextResponse.json({ data: rows, total: count ?? 0, page, pageSize, facets });
  } catch (e: any) {
    console.error('[search] error:', e);
    return NextResponse.json(
      { message: e?.message || 'internal error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';