// app/api/professor/publications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server-only key
);

// ---------- config ----------
const BUCKET = 'publication_files';

// ---------- helpers (auth / common) ----------
type UserPayload = { user_id: number; username: string; role: 'ADMIN'|'STAFF'|'PROFESSOR' };

async function getUserFromCookie(req: NextRequest): Promise<UserPayload | null> {
  const token = req.cookies.get('app_session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET!));
    return payload as UserPayload;
  } catch {
    return null;
  }
}

const toInt = (v: string | number | null, def: number | null = null) => {
  if (v === null || v === undefined) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

// UI -> DB enum
function uiStatusToDb(s: string) {
  const k = String(s || '').trim().toLowerCase();
  if (!k) return null;
  if (k === 'draft') return 'draft';
  if (k === 'under_review') return 'under_review';
  if (k === 'needs_revision') return 'needs_revision';
  if (k === 'published') return 'published';
  if (k === 'archived') return 'archived';
  return null;
}

const bad = (m: string, s = 400) => NextResponse.json({ ok: false, message: m }, { status: s });
const ok  = (obj: any = {}) => NextResponse.json({ ok: true, ...obj });

// ---------- helpers (DB upsert/find) ----------

async function upsertPersonWithType(
  full_name: string,
  email?: string | null,
  person_type?: string | null
) {
  const name = String(full_name || '').trim();
  if (!name) throw new Error('empty author full_name');

  const mail = (email ?? '').trim() || null;
  const ptype = person_type ? String(person_type).toUpperCase() : null;

  if (mail) {
    const { data: byMail, error: e1 } = await supabase
      .from('person')
      .select('person_id')
      .eq('email', mail)
      .maybeSingle();
    if (e1) throw e1;
    if (byMail?.person_id) return byMail.person_id as number;
  }

  if (ptype) {
    const { data: byNT, error: e2 } = await supabase
      .from('person')
      .select('person_id')
      .eq('full_name', name)
      .eq('person_type', ptype)
      .maybeSingle();
    if (e2) throw e2;
    if (byNT?.person_id) return byNT.person_id as number;
  }

  const { data: byName, error: e3 } = await supabase
    .from('person')
    .select('person_id')
    .eq('full_name', name)
    .maybeSingle();
  if (e3) throw e3;
  if (byName?.person_id) return byName.person_id as number;

  const { data: ins, error: e4 } = await supabase
    .from('person')
    .insert({ full_name: name, email: mail, person_type: ptype })
    .select('person_id')
    .single();
  if (e4) throw e4;
  return ins.person_id as number;
}

async function ensureCategory(name: string) {
  const cname = name.trim();
  if (!cname) return null;
  const { data: c, error: e1 } = await supabase
    .from('category')
    .select('category_id')
    .eq('category_name', cname)
    .maybeSingle();
  if (e1) throw e1;
  if (c) return c.category_id as number;

  const { data: ins, error: e2 } = await supabase
    .from('category')
    .insert({ category_name: cname, status: 'ACTIVE' })
    .select('category_id')
    .single();
  if (e2) throw e2;
  return ins.category_id as number;
}

function parseAuthorsFromForm(fd: FormData) {
  let s = (fd.get('authors_json') as string | null) ?? null;
  if (!s) s = (fd.get('authors') as string | null) ?? null;
  return parseAuthorsJson(s);
}

function parseAuthorsJson(
  s: string | null
): Array<{ full_name: string; email?: string | null; person_type?: string | null; role?: string; author_order?: number }>
{
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({
        full_name: String(x.full_name || '').trim(),
        email: x.email ? String(x.email).trim() : null,
        person_type: x.person_type ? String(x.person_type).toUpperCase() : null,
        role: x.role ? String(x.role) : undefined,
        author_order: Number(x.author_order) || undefined,
      }))
      .filter((x) => x.full_name.length > 0);
  } catch {
    return [];
  }
}

function parseHasPdf(val: unknown): boolean {
  const s = String(val ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'on' || s === 'yes';
}

function sanitizePathSegment(s: string) {
  return s.replace(/[^\w.\-]+/g, '_');
}

// ---------- GET ----------
export async function GET(req: NextRequest) {
  try {
    const me = await getUserFromCookie(req);
    if (!me) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (!(me.role === 'PROFESSOR' || me.role === 'ADMIN')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q           = searchParams.get('q')?.trim() || '';
    const statusUi    = searchParams.get('status')?.trim() || '';
    const level       = searchParams.get('level')?.trim() || '';
    const hasFileFlag = searchParams.get('hasFile') === '1' || searchParams.get('hasPdf') === '1';
    const onlyMine    = searchParams.get('mine') === '1';
    const withStudents= searchParams.get('withStudents') === '1';
    const yearFrom    = toInt(searchParams.get('yearFrom'));
    const yearTo      = toInt(searchParams.get('yearTo'));

    // ✅ ใหม่
    const authorName  = searchParams.get('author')?.trim() || '';
    const categoryQ   = searchParams.get('category')?.trim() || '';
    const venueTypeQ  = searchParams.get('venueType')?.trim() || '';

    const page        = Math.max(1, toInt(searchParams.get('page'), 1)!);
    const pageSize    = Math.min(50, Math.max(1, toInt(searchParams.get('pageSize'), 20)!));
    const from        = (page - 1) * pageSize;
    const to          = from + pageSize - 1;

    // ------- my person ids (สำหรับ mine) -------
    let myPersonIds: number[] = [];
    {
      const { data, error } = await supabase
        .from('person')
        .select('person_id')
        .eq('user_id', me.user_id);
      if (error) throw error;
      myPersonIds = (data || []).map((x: any) => x.person_id);
    }

    // ------- pub ids ของฉัน -------
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

    // ------- pub ids กับนิสิต -------
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

    // ------- ✅ pub ids ตามชื่อผู้เขียน -------
    let pubIdsByAuthor: number[] | null = null;
    if (authorName) {
      const { data, error } = await supabase
        .from('publication_person')
        .select('pub_id, person:person_id(full_name)')
        .ilike('person.full_name', `%${authorName}%`);
      if (error) throw error;
      pubIdsByAuthor = (data || []).map((x: any) => x.pub_id);
      if (pubIdsByAuthor.length === 0) return NextResponse.json({ data: [], total: 0 });
    }

    // ------- ✅ pub ids ตามหมวดหมู่ -------
    let pubIdsByCategory: number[] | null = null;
    if (categoryQ) {
      const { data, error } = await supabase
        .from('category_publication')
        .select('pub_id, category:category_id(category_name)')
        .ilike('category.category_name', `%${categoryQ}%`);
      if (error) throw error;
      pubIdsByCategory = (data || []).map((x: any) => x.pub_id);
      if (pubIdsByCategory.length === 0) return NextResponse.json({ data: [], total: 0 });
    }

    // ------- ✅ venue ids ตามประเภท (venue.type) -------
    let venueIdsByType: number[] | null = null;
    if (venueTypeQ) {
      const { data, error } = await supabase
        .from('venue')
        .select('venue_id')
        .ilike('type', `%${venueTypeQ}%`);
      if (error) throw error;
      venueIdsByType = (data || []).map((v: any) => v.venue_id);
      if (venueIdsByType.length === 0) return NextResponse.json({ data: [], total: 0 });
    }

    // ------- main query -------
    let query = supabase
      .from('publication')
      .select('pub_id, pub_name, venue_name, venue_id, level, year, status, has_pdf, link_url', { count: 'exact' });

    if (q) {
      query = query.or(`pub_name.ilike.%${q}%,venue_name.ilike.%${q}%,link_url.ilike.%${q}%`);
    }

    const statusDb = statusUi ? uiStatusToDb(statusUi) : null;
    if (statusDb) query = query.eq('status', statusDb);

    if (level)        query = query.ilike('level', level);
    if (hasFileFlag)  query = query.eq('has_pdf', true);
    if (yearFrom != null) query = query.gte('year', yearFrom);
    if (yearTo   != null) query = query.lte('year', yearTo);

    if (onlyMine)         query = query.in('pub_id', pubIdsMine);
    if (withStudents)     query = query.in('pub_id', pubIdsWithStudents);
    if (pubIdsByAuthor)   query = query.in('pub_id', pubIdsByAuthor);
    if (pubIdsByCategory) query = query.in('pub_id', pubIdsByCategory);
    if (venueIdsByType)   query = query.in('venue_id', venueIdsByType);

    query = query.order('year', { ascending: false }).range(from, to);

    const { data: pubs, error: qerr, count } = await query;
    if (qerr) throw qerr;

    const data = (pubs || []).map((p: any) => ({
      pub_id: p.pub_id,
      pub_name: p.pub_name ?? null,
      venue_name: p.venue_name ?? null,
      venue_id: p.venue_id ?? null,
      level: p.level ?? null,
      year: p.year ?? null,
      status: p.status ?? null,
      link_url: p.link_url ?? null,
      has_pdf: !!p.has_pdf,
    }));

    return NextResponse.json({ data, total: count ?? 0 });
  } catch (err: any) {
    console.error('professor publications error:', err?.message || err);
    return NextResponse.json({ message: err?.message || 'internal error' }, { status: 500 });
  }
}

// ---------- POST (เดิมของคุณ) ----------
export async function POST(req: NextRequest) {
  const me = await getUserFromCookie(req);
  if (!me) return bad('Unauthorized', 401);
  if (!(me.role === 'PROFESSOR' || me.role === 'ADMIN')) return bad('Forbidden', 403);

  try {
    const ct = req.headers.get('content-type') || '';

    // ---- multipart/form-data ----
    if (ct.startsWith('multipart/form-data')) {
      const fd = await req.formData();

      const levelRaw  = String(fd.get('level') || '').trim();
      const level     = levelRaw || null;
      const year      = Number(String(fd.get('year') || '').trim()) || null;
      const link      = String(fd.get('link_url') || '').trim() || null;
      const venue     = String(fd.get('venue_name') || '').trim() || null;
      const venueId   = Number(String(fd.get('venue_id') || '').trim()) || null;
      const abstract  = String(fd.get('abstract') || '').trim() || null;
      const statusUi  = String(fd.get('status') || '').trim() || 'draft';
      const catsRaw   = String(fd.get('categories') || '');

      const hasPdfFlag = parseHasPdf(fd.get('has_pdf'));

      const catNames = Array.from(new Set(
        catsRaw.split(',').map(s => s.trim()).filter(Boolean)
      ));

      const authors = parseAuthorsFromForm(fd);

      const pdf = fd.get('pdf') as File | null;

      // upload PDF
      let file_path: string | null = null;
      let has_pdf_final = hasPdfFlag;
      if (pdf && typeof pdf.name === 'string' && pdf.size > 0) {
        const isPdf = pdf.type === 'application/pdf' || pdf.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) return bad('รองรับเฉพาะไฟล์ PDF');
        const safeName = sanitizePathSegment(pdf.name);
        const path = `${me.user_id}/${Date.now()}-${safeName}`;
        const up = await supabase.storage.from(BUCKET).upload(path, pdf, {
          contentType: 'application/pdf',
          upsert: false,
        });
        if (up.error) throw up.error;
        file_path = up.data?.path || path;
        has_pdf_final = true;
      }

      const status = uiStatusToDb(statusUi) || 'draft';

      const insPub = await supabase
        .from('publication')
        .insert({
          level,
          year,
          has_pdf: has_pdf_final,
          link_url: link,
          venue_name: venue,
          venue_id: venueId,
          status,
          file_path,
          pub_name: String(fd.get('pub_name') || '').trim() || null,
          abstract,
        })
        .select('pub_id')
        .single();
      if (insPub.error) throw insPub.error;

      const pub_id = insPub.data.pub_id as number;

      if (catNames.length) {
        const rows: Array<{ pub_id: number; category_id: number }> = [];
        for (const raw of catNames) {
          const cid = await ensureCategory(String(raw));
          if (cid) rows.push({ pub_id, category_id: cid });
        }
        if (rows.length) {
          const { error } = await supabase.from('category_publication').insert(rows);
          if (error) throw error;
        }
      }

      if (authors.length) {
        const rows: Array<{ pub_id: number; person_id: number; role: string | null; author_order: number | null }> = [];
        for (const a of authors) {
          const pid = await upsertPersonWithType(a.full_name, a.email ?? null, a.person_type ?? null);
          rows.push({
            pub_id,
            person_id: pid,
            role: a.role || null,
            author_order: a.author_order || null,
          });
        }
        if (rows.length) {
          const { error } = await supabase.from('publication_person').insert(rows);
          if (error) throw error;
        }
      }

      const { error: histErr } = await supabase
        .from('publication_status_history')
        .insert([{
          pub_id,
          status,
          user_id: me.user_id,
          changed_by: me.user_id,
          note: null,
        }]);
      if (histErr) throw histErr;

      return ok({ pub_id });
    }

    // ---- JSON ----
    const body = await req.json();

    const status = uiStatusToDb(body.status) || 'draft';

    const payload = {
      level: body.level ?? null,
      year: toInt(body.year, null),
      has_pdf: !!body.has_pdf,
      link_url: body.link_url ?? null,
      venue_name: body.venue_name ?? null,
      venue_id: toInt(body.venue_id, null) as number | null,
      status,
      file_path: null,
      pub_name: body.pub_name ?? null,
      abstract: body.abstract ?? null,
    };

    const { data: pub, error: perr } = await supabase
      .from('publication')
      .insert(payload)
      .select('pub_id')
      .single();
    if (perr) throw perr;

    const pub_id = pub.pub_id as number;

    let authorsArr: ReturnType<typeof parseAuthorsJson> = [];
    if (typeof body.authors_json === 'string') {
      authorsArr = parseAuthorsJson(body.authors_json);
    } else if (Array.isArray(body.authors)) {
      authorsArr = (body.authors || []).map((a: any, i: number) => ({
        full_name: String(a.full_name || '').trim(),
        email: a.email ? String(a.email).trim() : null,
        person_type: a.person_type ? String(a.person_type).toUpperCase() : null,
        role: a.role ? String(a.role) : undefined,
        author_order: Number(a.author_order) || i + 1,
      })).filter((x: any) => x.full_name.length > 0);
    }

    if (authorsArr.length) {
      const rows: Array<{ pub_id: number; person_id: number; role: string | null; author_order: number | null }> = [];
      for (const a of authorsArr) {
        const pid = await upsertPersonWithType(a.full_name, a.email ?? null, a.person_type ?? null);
        rows.push({
          pub_id,
          person_id: pid,
          role: a.role || null,
          author_order: a.author_order || null,
        });
      }
      const { error } = await supabase.from('publication_person').insert(rows);
      if (error) throw error;
    }

    let catNames: string[] = [];
    if (Array.isArray(body.categories)) {
      catNames = body.categories.map((s: any) => String(s).trim()).filter(Boolean);
    } else if (typeof body.categories === 'string') {
      catNames = body.categories.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    if (catNames.length) {
      const rows: Array<{ pub_id: number; category_id: number }> = [];
      for (const raw of Array.from(new Set(catNames))) {
        const cid = await ensureCategory(String(raw));
        if (cid) rows.push({ pub_id, category_id: cid });
      }
      if (rows.length) {
        const { error } = await supabase.from('category_publication').insert(rows);
        if (error) throw error;
      }
    }

    const { error: histErr } = await supabase
      .from('publication_status_history')
      .insert([{
        pub_id,
        status,
        user_id: me.user_id,
        changed_by: me.user_id,
        note: null,
      }]);
    if (histErr) throw histErr;

    return NextResponse.json({ ok: true, pub_id }, { status: 201 });
  } catch (err: any) {
    console.error('create professor publication error:', err?.message || err);
    return NextResponse.json({ message: err?.message || 'internal error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
