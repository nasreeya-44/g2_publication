// app/api/publications/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ---------- Types ----------
type ResultItem = {
  pub_id: number;
  title?: string | null;
  venue_name?: string | null;
  level?: string | null;        // JOURNAL / CONF / BOOK (ปรับตามที่คุณใช้จริง)
  year?: number | null;
  has_pdf?: boolean | null;
  link_url?: string | null;
  authors: string[];
  categories: string[];
};

type PubRow = {
  pub_id: number;
  year: number | null;
  has_pdf: boolean | null;
  level: string | null;
  venue_name: string | null;
  link_url: string | null;
  title?: string | null;
};

type PubPersonJoin = {
  pub_id: number;
  author_order: number | null;
  person: { full_name: string | null } | null;
};

type CategoryJoin = {
  pub_id: number;
  category: { category_name: string | null } | null;
};

// ---------- Supabase client ----------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server-only key
);

// helper: parse int safely
function toInt(s: string | null, def: number | null = null) {
  if (!s) return def;
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';
    const author = searchParams.get('author')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';
    const type = searchParams.get('type')?.trim() || ''; // JOURNAL/CONF/BOOK
    const hasPdf = searchParams.get('hasPdf') === '1';
    const yearFrom = toInt(searchParams.get('yearFrom'));
    const yearTo = toInt(searchParams.get('yearTo'));
    const page = Math.max(1, toInt(searchParams.get('page'), 1)!);
    const pageSize = Math.min(50, Math.max(1, toInt(searchParams.get('pageSize'), 10)!));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 1) หา pub_ids จาก "author" และ "category"
    let authorPubIds: number[] = [];
    if (author) {
      const { data: ap, error: aerr } = await supabase
        .from('publication_person')
        .select('pub_id, person:person_id(full_name)')
        // ใช้ filter() แทน ilike() เพื่อลด TS error
        .filter('person.full_name', 'ilike', `%${author}%`);
      if (aerr) throw aerr;
      authorPubIds = ((ap as PubPersonJoin[] | null) ?? []).map((x) => x.pub_id);
    }

    let categoryPubIds: number[] = [];
    if (category) {
      const { data: cp, error: cerr } = await supabase
        .from('category_publication')
        .select('pub_id, category:category_id(category_name)')
        .filter('category.category_name', 'ilike', `%${category}%`);
      if (cerr) throw cerr;
      categoryPubIds = ((cp as CategoryJoin[] | null) ?? []).map((x) => x.pub_id);
    }

    // 2) main query: publication (เฉพาะฟิลด์จำเป็น)
    let query = supabase
      .from('publication')
      .select('pub_id, year, has_pdf, level, venue_name, link_url', { count: 'exact' });

    if (q) {
      // ค้นใน venue_name / link_url
      query = query.or(`venue_name.ilike.%${q}%,link_url.ilike.%${q}%`);
    }
    if (type) {
      query = query.eq('level', type);
    }
    if (hasPdf) {
      query = query.eq('has_pdf', true);
    }
    if (yearFrom != null) {
      query = query.gte('year', yearFrom);
    }
    if (yearTo != null) {
      query = query.lte('year', yearTo);
    }
    if (authorPubIds.length) {
      query = query.in('pub_id', Array.from(new Set(authorPubIds)));
    }
    if (categoryPubIds.length) {
      query = query.in('pub_id', Array.from(new Set(categoryPubIds)));
    }

    query = query.order('year', { ascending: false }).range(from, to);

    const { data: pubs, error: perr, count } = await query;
    if (perr) throw perr;

    const pubIds = (((pubs as PubRow[] | null) ?? [])).map((p) => p.pub_id);
    const authorsByPub: Record<number, string[]> = {};
    const catsByPub: Record<number, string[]> = {};
    const allCategories: Set<string> = new Set();

    if (pubIds.length) {
      // 3) ดึงผู้เขียน
      const { data: ppl, error: perr2 } = await supabase
        .from('publication_person')
        .select('pub_id, author_order, person:person_id(full_name)')
        .in('pub_id', pubIds)
        .order('author_order', { ascending: true });
      if (perr2) throw perr2;

      for (const row of ((ppl as PubPersonJoin[] | null) ?? [])) {
        const pid = row.pub_id;
        const name = row.person?.full_name ?? undefined;
        if (!name) continue;
        if (!authorsByPub[pid]) authorsByPub[pid] = [];
        authorsByPub[pid].push(name);
      }

      // 4) ดึงหมวดหมู่
      const { data: cps, error: perr3 } = await supabase
        .from('category_publication')
        .select('pub_id, category:category_id(category_name)')
        .in('pub_id', pubIds);
      if (perr3) throw perr3;

      for (const row of ((cps as CategoryJoin[] | null) ?? [])) {
        const pid = row.pub_id;
        const cname = row.category?.category_name ?? undefined;
        if (!cname) continue;
        if (!catsByPub[pid]) catsByPub[pid] = [];
        catsByPub[pid].push(cname);
        allCategories.add(cname);
      }
    }

    // 5) ประกอบผลลัพธ์
    const data: ResultItem[] =
      (((pubs as PubRow[] | null) ?? [])).map((p): ResultItem => ({
        pub_id: p.pub_id,
        title: (p as any).title ?? null, // ถ้าตารางมี title ก็จะมา
        venue_name: p.venue_name ?? null,
        level: p.level ?? null,
        year: p.year ?? null,
        has_pdf: p.has_pdf ?? null,
        link_url: p.link_url ?? null,
        authors: authorsByPub[p.pub_id] || [],
        categories: catsByPub[p.pub_id] || [],
      }));

    return NextResponse.json({
      data,
      total: count ?? 0,
      categories: Array.from(allCategories).sort(), // เติม dropdown ที่หน้า UI
    });
  } catch (err: any) {
    console.error('search API error:', err?.message || err);
    return NextResponse.json({ message: err?.message || 'internal error' }, { status: 500 });
  }
}
