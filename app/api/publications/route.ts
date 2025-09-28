// app/api/publications/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// อ่าน ENV ทั้ง 2 ชื่อเพื่อกันพลาด
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

type Row = {
  pub_id: number;
  year: number | null;
  type: string | null;      // จาก venue.type
  level: string | null;
  has_pdf: boolean;
  status: string | null;
  link_url: string | null;
  venue_name: string | null;
  updated_at: string | null;
  authors: string[];
  categories: string[];
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const q         = (searchParams.get('q') || '').trim();
    const author    = (searchParams.get('author') || '').trim();
    const category  = (searchParams.get('category') || '').trim();
    const type      = (searchParams.get('type') || '').trim(); // JOURNAL/CONFERENCE/BOOK/OTHER
    const yearFrom  = (searchParams.get('year_from') || '').trim();
    const yearTo    = (searchParams.get('year_to') || '').trim();
    const hasPdf    = (searchParams.get('has_pdf') || '').trim(); // '1'|'0'|'ALL'

    const page      = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize  = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || 10)));
    const fromIdx   = (page - 1) * pageSize;
    const toIdx     = fromIdx + pageSize - 1;

    // --------------------------
    // Pre-filter: type (จาก venue.type)
    // --------------------------
    let venueIdFilter: number[] | null = null;
    if (type && type !== 'ALL') {
      const { data: vrows, error: verr } = await supabase
        .from('venue')
        .select('venue_id')
        .eq('type', type);
      if (verr) {
        console.error('[search] venue type prefilter error:', verr.message);
        return NextResponse.json({ data: [], total: 0, page, pageSize });
      }
      const ids = (vrows || []).map((r: any) => r.venue_id).filter((x: any) => Number.isFinite(x));
      if (ids.length === 0) {
        // ไม่มี venue ที่ตรง → ผลลัพธ์ว่าง
        return NextResponse.json({ data: [], total: 0, page, pageSize });
      }
      venueIdFilter = ids;
    }

    // --------------------------
    // Pre-filter: author (publication_person -> person.full_name)
    // --------------------------
    let authorPubIds: number[] | null = null;
    if (author) {
      const { data: arows, error: aerr } = await supabase
        .from('publication_person')
        .select('pub_id, person:person_id(full_name)')
        .ilike('person.full_name', `%${author}%`);
      if (aerr) {
        console.error('[search] author prefilter error:', aerr.message);
        return NextResponse.json({ data: [], total: 0, page, pageSize });
      }
      const ids = (arows || [])
        .map((r: any) => r.pub_id)
        .filter((x: any) => Number.isFinite(x));
      if (ids.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, pageSize });
      }
      authorPubIds = Array.from(new Set(ids));
    }

    // --------------------------
    // Pre-filter: category (category_publication -> category.category_name)
    // --------------------------
    let categoryPubIds: number[] | null = null;
    if (category) {
      const { data: crows, error: cerr } = await supabase
        .from('category_publication')
        .select('pub_id, category:category_id(category_name)')
        .ilike('category.category_name', `%${category}%`);
      if (cerr) {
        console.error('[search] category prefilter error:', cerr.message);
        return NextResponse.json({ data: [], total: 0, page, pageSize });
      }
      const ids = (crows || [])
        .map((r: any) => r.pub_id)
        .filter((x: any) => Number.isFinite(x));
      if (ids.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, pageSize });
      }
      categoryPubIds = Array.from(new Set(ids));
    }

    // --------------------------
    // สร้าง query หลัก
    // --------------------------
    let base = supabase
      .from('publication')
      .select(
        `
        pub_id, year, level, has_pdf, status, link_url, file_path, updated_at, venue_id,
        venue:venue_id(name, type)
      `,
        { count: 'exact' } // ขอนับจำนวนแถวทั้งหมด
      )
      .eq('status', 'APPROVED'); // ✅ แสดงเฉพาะที่ APPROVED

    if (q) {
      // ค้นหาแบบเร็ว: link_url หรือ venue_name
      // ถ้าในตารางคุณมีคอลัมน์ venue_name ใน publication → ใช้เงื่อนไขใน or ได้เลย
      // ถ้าไม่มี venue_name ให้ใช้เฉพาะ link_url
      base = base.or(`link_url.ilike.%${q}%,venue_name.ilike.%${q}%`);
    }

    if (venueIdFilter) {
      base = base.in('venue_id', venueIdFilter);
    }

    if (authorPubIds) {
      base = base.in('pub_id', authorPubIds);
    }

    if (categoryPubIds) {
      base = base.in('pub_id', categoryPubIds);
    }

    if (yearFrom) {
      const y = Number(yearFrom);
      if (Number.isFinite(y)) base = base.gte('year', y);
    }
    if (yearTo) {
      const y = Number(yearTo);
      if (Number.isFinite(y)) base = base.lte('year', y);
    }

    if (hasPdf === '1') base = base.eq('has_pdf', true);
    if (hasPdf === '0') base = base.eq('has_pdf', false);

    base = base
      .order('updated_at', { ascending: false })
      .range(fromIdx, toIdx);

    const { data: pubs, error: perr, count } = await base;
    if (perr) {
      console.error('[search] publication query error:', perr.message);
      return NextResponse.json(
        { data: [], total: 0, page, pageSize, message: perr.message },
        { status: 500 }
      );
    }

    const rows = pubs || [];
    const pubIds = rows.map((r: any) => r.pub_id);
    if (pubIds.length === 0) {
      return NextResponse.json({
        data: [],
        total: count || 0,
        page,
        pageSize
      });
    }

    // -------- Authors (batch) --------
    const { data: arows, error: aerr } = await supabase
      .from('publication_person')
      .select('pub_id, author_order, person:person_id(full_name)')
      .in('pub_id', pubIds)
      .order('author_order', { ascending: true });

    if (aerr) {
      console.error('[search] authors load error:', aerr.message);
    }
    const authorsByPub: Record<number, string[]> = {};
    for (const r of arows || []) {
      const pid = r.pub_id as number;
      const name = r.person?.full_name || '';
      if (!authorsByPub[pid]) authorsByPub[pid] = [];
      if (name) authorsByPub[pid].push(name);
    }

    // -------- Categories (batch) --------
    const { data: crows, error: cerr } = await supabase
      .from('category_publication')
      .select('pub_id, category:category_id(category_name)')
      .in('pub_id', pubIds);

    if (cerr) {
      console.error('[search] categories load error:', cerr.message);
    }
    const categoriesByPub: Record<number, string[]> = {};
    for (const r of crows || []) {
      const pid = r.pub_id as number;
      const name = r.category?.category_name || '';
      if (!categoriesByPub[pid]) categoriesByPub[pid] = [];
      if (name) categoriesByPub[pid].push(name);
    }

    // -------- Map to response rows --------
    const data: Row[] = rows.map((p: any) => ({
      pub_id: p.pub_id,
      year: p.year ?? null,
      type: p.venue?.type ?? null,               // จาก venue.type
      level: p.level ?? null,
      has_pdf: !!p.has_pdf,
      status: p.status ?? null,
      link_url: p.link_url ?? null,
      venue_name: p.venue?.name ?? p.venue_name ?? null,
      updated_at: p.updated_at ?? null,
      authors: authorsByPub[p.pub_id] || [],
      categories: categoriesByPub[p.pub_id] || [],
    }));

    return NextResponse.json({
      data,
      total: count || data.length,
      page,
      pageSize,
    });
  } catch (e: any) {
    console.error('[search] error:', e);
    return NextResponse.json(
      { data: [], total: 0, page: 1, pageSize: 10, message: e?.message || 'internal error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';