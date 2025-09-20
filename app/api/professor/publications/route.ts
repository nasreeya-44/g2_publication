// app/api/professor/publications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server-only key
);

// ---- helpers ----
async function getUserFromCookie(req: NextRequest) {
  const token = req.cookies.get('app_session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET!));
    return payload as { user_id: number; username: string; role: 'ADMIN' | 'STAFF' | 'PROFESSOR' };
  } catch {
    return null;
  }
}
const toInt = (v: string | number | null, def: number | null = null) => {
  if (v === null || v === undefined) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
// UI: DRAFT / UNDER_REVIEW / PUBLISHED / ARCHIVED  -> DB enum (คาดว่าเป็นตัวเล็ก)
function uiStatusToDb(s: string) {
  const k = String(s || '').trim().toLowerCase();
  if (!k) return null;
  if (k === 'draft') return 'draft';
  if (k === 'under_review') return 'under_review';
  if (k === 'published') return 'published';
  if (k === 'archived') return 'archived';
  return null;
}

// upsert person (อิง email ก่อน ถ้าไม่มีค่อยอิงชื่อ)
async function upsertPerson(full_name: string, email?: string | null, affiliation?: string | null) {
  if (email) {
    const { data: byMail } = await supabase
      .from('person')
      .select('person_id')
      .eq('email', email)
      .maybeSingle();
    if (byMail) return byMail.person_id as number;
  }
  const { data: byName } = await supabase
    .from('person')
    .select('person_id')
    .eq('full_name', full_name)
    .maybeSingle();
  if (byName) return byName.person_id as number;

  const { data: ins, error } = await supabase
    .from('person')
    .insert({ full_name, email: email || null, affiliation: affiliation || null })
    .select('person_id')
    .single();
  if (error) throw error;
  return ins.person_id as number;
}

async function ensureCategory(name: string) {
  const cname = name.trim();
  if (!cname) return null;
  const { data: c } = await supabase
    .from('category')
    .select('category_id')
    .eq('category_name', cname)
    .maybeSingle();
  if (c) return c.category_id as number;

  const { data: ins, error } = await supabase
    .from('category')
    .insert({ category_name: cname, status: 'active' })
    .select('category_id')
    .single();
  if (error) throw error;
  return ins.category_id as number;
}

/* ===========================
   GET  : list publications (เดิม)
   =========================== */
export async function GET(req: NextRequest) {
  try {
    // 1) auth + role guard
    const me = await getUserFromCookie(req);
    if (!me) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (!(me.role === 'PROFESSOR' || me.role === 'ADMIN')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // 2) รับพารามิเตอร์จากหน้าแดชบอร์ด
    const { searchParams } = new URL(req.url);
    const q        = searchParams.get('q')?.trim() || '';
    const statusUi = searchParams.get('status')?.trim() || '';
    const level    = searchParams.get('level')?.trim() || '';     // text
    const hasPdf   = searchParams.get('hasPdf') === '1';
    const onlyMine = searchParams.get('mine') === '1';
    const withStudents = searchParams.get('withStudents') === '1';
    const yearFrom = toInt(searchParams.get('yearFrom'));
    const yearTo   = toInt(searchParams.get('yearTo'));
    const page     = Math.max(1, toInt(searchParams.get('page'), 1)!);
    const pageSize = Math.min(50, Math.max(1, toInt(searchParams.get('pageSize'), 10)!));
    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    // 3) หา person_id ของผู้ใช้คนนี้ (เพื่อกรอง "เฉพาะงานของฉัน")
    let myPersonIds: number[] = [];
    {
      const { data, error } = await supabase
        .from('person')
        .select('person_id')
        .eq('user_id', me.user_id);
      if (error) throw error;
      myPersonIds = (data || []).map((x: any) => x.person_id);
    }

    // 4) เตรียม pub_ids ตามเงื่อนไขพิเศษ
    let pubIdsMine: number[] = [];
    if (onlyMine) {
      if (!myPersonIds.length) return NextResponse.json({ data: [], total: 0 });
      const { data, error } = await supabase
        .from('publication_person')
        .select('pub_id')
        .in('person_id', myPersonIds);
      if (error) throw error;
      pubIdsMine = (data || []).map((x: any) => x.pub_id);
      if (!pubIdsMine.length) return NextResponse.json({ data: [], total: 0 });
    }

    let pubIdsWithStudents: number[] = [];
    if (withStudents) {
      const { data, error } = await supabase
        .from('publication_person')
        .select('pub_id, person:person_id(person_type)')
        .not('person.person_type', 'is', null);
      if (error) throw error;
      pubIdsWithStudents = (data || [])
        .filter((x: any) => String(x.person?.person_type || '').toLowerCase() === 'student')
        .map((x: any) => x.pub_id);
      if (!pubIdsWithStudents.length) return NextResponse.json({ data: [], total: 0 });
    }

    // 5) main query: publication
    let query = supabase
      .from('publication')
      .select('pub_id, venue_name, level, year, status, has_pdf, link_url', { count: 'exact' });

    if (q) {
      query = query.or(`venue_name.ilike.%${q}%,link_url.ilike.%${q}%`);
      // ถ้าตารางมี title: เพิ่ม title.ilike.%${q}% ได้
    }

    const statusDb = statusUi ? uiStatusToDb(statusUi) : null;
    if (statusDb) query = query.eq('status', statusDb);

    if (level)   query = query.ilike('level', level); // case-insensitive
    if (hasPdf)  query = query.eq('has_pdf', true);
    if (yearFrom != null) query = query.gte('year', yearFrom);
    if (yearTo   != null) query = query.lte('year', yearTo);

    if (onlyMine)       query = query.in('pub_id', pubIdsMine);
    if (withStudents)   query = query.in('pub_id', pubIdsWithStudents);

    query = query.order('year', { ascending: false }).range(from, to);

    const { data: pubs, error: qerr, count } = await query;
    if (qerr) throw qerr;

    const data = (pubs || []).map((p: any) => ({
      pub_id: p.pub_id,
      title: p.title ?? null,
      venue_name: p.venue_name ?? null,
      level: p.level ?? null,
      year: p.year ?? null,
      status: p.status ?? null,
      link_url: p.link_url ?? null,
    }));

    return NextResponse.json({ data, total: count ?? 0 });
  } catch (err: any) {
    console.error('professor publications error:', err?.message || err);
    return NextResponse.json({ message: err?.message || 'internal error' }, { status: 500 });
  }
}

/* ===========================
   POST : create new publication
   body:
   {
     level: 'NATIONAL' | 'INTERNATIONAL',
     year: number,
     has_pdf: boolean,
     link_url?: string,
     venue_name?: string,
     status?: 'draft' | 'under_review' | 'published' | 'archived',
     authors?: [{ full_name: string, email?: string, affiliation?: string, role?: string, author_order?: number }],
     categories?: string[]
   }
   =========================== */
export async function POST(req: NextRequest) {
  const me = await getUserFromCookie(req);
  if (!me) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (!(me.role === 'PROFESSOR' || me.role === 'ADMIN')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();

    const payload = {
      level: body.level ?? null,                            // NATIONAL/INTERNATIONAL
      year: toInt(body.year, null),                        // number | null
      has_pdf: !!body.has_pdf,
      link_url: body.link_url ?? null,
      venue_name: body.venue_name ?? null,
      status: uiStatusToDb(body.status) || 'draft',        // default draft
    };

    // 1) insert publication
    const { data: pub, error: perr } = await supabase
      .from('publication')
      .insert(payload)
      .select('pub_id')
      .single();
    if (perr) throw perr;

    const pub_id = pub.pub_id as number;

    // 2) authors (optional)
    if (Array.isArray(body.authors) && body.authors.length) {
      for (const a of body.authors) {
        const pid = await upsertPerson(a.full_name, a.email ?? null, a.affiliation ?? null);
        const row = {
          pub_id,
          person_id: pid,
          author_order: toInt(a.author_order, null),
          role: a.role ?? null,
        };
        const { error } = await supabase.from('publication_person').insert(row);
        if (error) throw error;
      }
    }

    // 3) categories (optional)
    if (Array.isArray(body.categories) && body.categories.length) {
      for (const raw of body.categories) {
        const cid = await ensureCategory(String(raw));
        if (!cid) continue;
        const { error } = await supabase
          .from('category_publication')
          .insert({ pub_id, category_id: cid });
        if (error) throw error;
      }
    }

    return NextResponse.json({ ok: true, pub_id }, { status: 201 });
  } catch (err: any) {
    console.error('create professor publication error:', err?.message || err);
    return NextResponse.json({ message: err?.message || 'internal error' }, { status: 500 });
  }
}
