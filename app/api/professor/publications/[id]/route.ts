// app/api/professor/publications/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const BUCKET = 'publication_files';

type UserPayload = { user_id: number; username: string; role: 'ADMIN'|'STAFF'|'PROFESSOR' };

async function getUser(req: NextRequest): Promise<UserPayload | null> {
  const token = req.cookies.get('app_session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.SESSION_SECRET!)
    );
    return payload as UserPayload;
  } catch {
    return null;
  }
}

const bad = (m: string, s = 400) => NextResponse.json({ ok: false, message: m }, { status: s });
const same = (a: any, b: any) => String(a ?? '') === String(b ?? '');
const canEdit = (r?: string) => r === 'PROFESSOR' || r === 'ADMIN';
const parseHas = (v: unknown) => {
  const s = String(v ?? '').toLowerCase();
  return s === '1' || s === 'true' || s === 'on' || s === 'yes';
};
const sanitize = (s: string) => s.replace(/[^\w.\-]+/g, '_');

/* ---------------- helpers ---------------- */
async function findOrInsertPerson(input: {
  full_name: string;
  email?: string | null;
  affiliation?: string | null;
  person_type?: string | null;
}): Promise<number> {
  const full_name = input.full_name.trim();
  const email = (input.email ?? '').trim() || null;
  const affiliation = input.affiliation ?? null;
  const person_type = input.person_type ?? null;

  if (email) {
    const { data: p1, error: e1 } = await supabase
      .from('person')
      .select('person_id')
      .eq('email', email)
      .maybeSingle();
    if (e1) throw e1;
    if (p1?.person_id) return p1.person_id;
  }

  const { data: p2, error: e2 } = await supabase
    .from('person')
    .select('person_id')
    .eq('full_name', full_name)
    .maybeSingle();
  if (e2) throw e2;
  if (p2?.person_id) return p2.person_id;

  const { data: ins, error: e3 } = await supabase
    .from('person')
    .insert({ full_name, email, affiliation, person_type })
    .select('person_id')
    .single();
  if (e3) throw e3;
  return ins.person_id as number;
}

async function getExistingCategoryIdsByName(names: string[]): Promise<Record<string, number>> {
  const uniq = Array.from(new Set(names.map(s => s.trim()).filter(Boolean)));
  if (!uniq.length) return {};
  const { data, error } = await supabase
    .from('category')
    .select('category_id, category_name')
    .in('category_name', uniq);
  if (error) throw error;
  const map: Record<string, number> = {};
  for (const r of data || []) map[r.category_name] = r.category_id;
  return map;
}

/* ---------------- GET ---------------- */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getUser(req);
  if (!me) return bad('Unauthorized', 401);
  if (!canEdit(me.role)) return bad('Forbidden', 403);

  const pubId = Number(params.id);
  if (!Number.isFinite(pubId)) return bad('Invalid id');

  try {
    const { data: pub, error } = await supabase
      .from('publication')
      .select(`
        pub_id, pub_name, link_url, level, year, has_pdf, file_path,
        venue_id, venue_name, status, created_at, updated_at,
        abstract
      `)
      .eq('pub_id', pubId)
      .maybeSingle();
    if (error) throw error;
    if (!pub) return bad('Not found', 404);

    const { data: ppl } = await supabase
      .from('publication_person')
      .select('author_order, role, person:person_id(full_name, email, affiliation, person_type)')
      .eq('pub_id', pubId)
      .order('author_order', { ascending: true });

    const authors = (ppl || []).map((r: any) => ({
      full_name: r.person?.full_name ?? '',
      email: r.person?.email ?? null,
      affiliation: r.person?.affiliation ?? null,
      person_type: r.person?.person_type ?? null,
      author_order: r.author_order ?? null,
      role: (r.role as string) ?? null,
    }));

    const { data: cps } = await supabase
      .from('category_publication')
      .select('category:category_id(category_name)')
      .eq('pub_id', pubId);

    const categories = (cps || [])
      .map((x: any) => x.category?.category_name as string | undefined)
      .filter(Boolean) as string[];

    const { data: logs } = await supabase
      .from('publication_edit_log')
      .select('edited_at, field_name, old_value, new_value, user:user_id(first_name, last_name, username)')
      .eq('pub_id', pubId)
      .order('edited_at', { ascending: false })
      .limit(50);

    const history = (logs || []).map((l: any) => ({
      edited_at: l.edited_at,
      field_name: l.field_name,
      old_value: l.old_value,
      new_value: l.new_value,
      user_name:
        `${l.user?.first_name ?? ''} ${l.user?.last_name ?? ''}`.trim() || l.user?.username || null,
    }));

    return NextResponse.json({
      ok: true,
      ...pub,
      authors,
      categories,
      history,
    });
  } catch (e: any) {
    console.error('professor detail error:', e?.message || e);
    return bad(e?.message || 'internal error', 500);
  }
}

/* ---------------- PATCH ---------------- */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getUser(req);
  if (!me) return bad('Unauthorized', 401);
  if (!canEdit(me.role)) return bad('Forbidden', 403);

  const pubId = Number(params.id);
  if (!Number.isFinite(pubId)) return bad('Invalid id');

  try {
    const { data: before, error: berr } = await supabase
      .from('publication')
      .select('pub_name, venue_id, venue_name, level, year, status, has_pdf, link_url, file_path, abstract')
      .eq('pub_id', pubId)
      .maybeSingle();
    if (berr) throw berr;
    if (!before) return bad('Not found', 404);

    const ct = req.headers.get('content-type') || '';

    /* ---------- multipart/form-data ---------- */
    if (ct.startsWith('multipart/form-data')) {
      const fd = await req.formData();

      const fromTitle = String(fd.get('title_th') || fd.get('_extra_title_th') || '').trim();
      const pub_name = String(fd.get('pub_name') || fromTitle || '').trim() || null;

      const venueIdRaw = String(fd.get('venue_id') || '').trim();
      const venue_id = venueIdRaw ? Number(venueIdRaw) : null;

      // ใส่ status เฉพาะเมื่อมีส่งมาและไม่ว่าง
      const statusRaw = String(fd.get('status') || '').trim();
      const hasStatus = statusRaw.length > 0;

      // ----- abstract ops -----
      // 1) หากส่ง abstract มา -> แทนที่ทั้งข้อความ (ยอมรับค่าว่างเพื่อล้าง)
      // 2) มิฉะนั้น ใช้ตัวแก้แบบเพิ่ม/ลบ
      let nextAbstract: string | null | undefined;
      if (fd.has('abstract')) {
        const rep = String(fd.get('abstract') ?? '');
        nextAbstract = rep.trim() ? rep : null;
      } else {
        let cur = String(before.abstract ?? '');
        if (fd.has('abstract_prepend')) {
          cur = String(fd.get('abstract_prepend') ?? '') + cur;
        }
        if (fd.has('abstract_append')) {
          cur = cur + String(fd.get('abstract_append') ?? '');
        }
        if (fd.has('abstract_delete')) {
          const sub = String(fd.get('abstract_delete') ?? '');
          if (sub) cur = cur.replace(sub, '');
        }
        const delFromRaw = String(fd.get('abstract_delete_from') ?? '');
        const delToRaw   = String(fd.get('abstract_delete_to') ?? '');
        const delFrom = Number(delFromRaw);
        const delTo   = Number(delToRaw);
        if (Number.isFinite(delFrom) && Number.isFinite(delTo) && delTo >= delFrom && delFrom >= 0) {
          cur = cur.slice(0, delFrom) + cur.slice(delTo);
        }
        // ถ้าไม่มีการเปลี่ยนแปลงอะไรเลยก็ไม่ต้องส่ง abstract ใน payload
        if (cur !== String(before.abstract ?? '')) {
          nextAbstract = cur.trim() ? cur : null;
        }
      }

      const basePayload: Record<string, any> = {
        pub_name,
        venue_name: (String(fd.get('venue_name') || '')).trim() || null,
        level: String(fd.get('level') || '').trim() || null,
        year: Number(String(fd.get('year') || '').trim()) || null,
        link_url: String(fd.get('link_url') || '').trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (venueIdRaw !== '') basePayload.venue_id = venue_id;
      if (hasStatus) basePayload.status = statusRaw;
      if (nextAbstract !== undefined) basePayload.abstract = nextAbstract;

      // PDF
      const remove_pdf = parseHas(fd.get('remove_pdf'));
      const pdf = fd.get('pdf') as File | null;
      let next_file_path: string | null | undefined;
      let next_has_pdf: boolean | undefined;

      if (remove_pdf && before.file_path) {
        await supabase.storage.from(BUCKET).remove([before.file_path]);
        next_file_path = null;
        next_has_pdf = false;
      }
      if (pdf && typeof pdf.name === 'string' && pdf.size > 0) {
        const isPdf = pdf.type === 'application/pdf' || pdf.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) return bad('รองรับเฉพาะไฟล์ PDF');
        if (before.file_path) await supabase.storage.from(BUCKET).remove([before.file_path]);
        const path = `${me.user_id}/${Date.now()}-${sanitize(pdf.name)}`;
        const up = await supabase.storage.from(BUCKET).upload(path, pdf, {
          contentType: 'application/pdf',
          upsert: false,
        });
        if (up.error) throw up.error;
        next_file_path = up.data?.path || path;
        next_has_pdf = true;
      }

      const upd: any = { ...basePayload };
      if (next_file_path !== undefined) upd.file_path = next_file_path;
      if (next_has_pdf !== undefined) upd.has_pdf = next_has_pdf;

      const { error: uerr } = await supabase.from('publication').update(upd).eq('pub_id', pubId);
      if (uerr) throw uerr;

      // logs & status history
      const changed: Array<{ field: string; old: any; val: any }> = [];
      for (const f of Object.keys(upd)) {
        if (f in before && !same((before as any)[f], upd[f])) {
          changed.push({ field: f, old: (before as any)[f], val: upd[f] });
        }
      }
      if (changed.length) {
        await supabase.from('publication_edit_log').insert(
          changed.map((c) => ({
            pub_id: pubId,
            user_id: me.user_id,
            field_name: c.field,
            old_value: c.old !== null ? String(c.old) : null,
            new_value: c.val !== null ? String(c.val) : null,
          }))
        );
      }
      if (hasStatus && !same((before as any).status, statusRaw)) {
        await supabase.from('publication_status_history').insert({
          pub_id: pubId,
          user_id: me.user_id,
          changed_by: me.user_id,
          status: statusRaw,
          note: null,
        });
      }

      // authors_json
      const authors_json = String(fd.get('authors_json') || '');
      if (authors_json) {
        let authors: Array<{ full_name: string; email?: string | null; person_type?: string | null; role?: string | null; author_order?: number | null }> = [];
        try {
          const arr = JSON.parse(authors_json);
          if (Array.isArray(arr)) {
            authors = arr
              .map((x) => ({
                full_name: String(x.full_name || '').trim(),
                email: x.email ? String(x.email) : null,
                person_type: x.person_type ? String(x.person_type) : null,
                role: x.role ? String(x.role) : null,
                author_order: Number(x.author_order) || null,
              }))
              .filter((x) => x.full_name.length > 0);
          }
        } catch {}
        await supabase.from('publication_person').delete().eq('pub_id', pubId);
        for (const a of authors) {
          const person_id = await findOrInsertPerson({
            full_name: a.full_name,
            email: a.email,
            person_type: a.person_type,
          });
          const { error: insA } = await supabase.from('publication_person').insert({
            pub_id: pubId,
            person_id,
            author_order: a.author_order,
            role: a.role,
          });
          if (insA) throw insA;
        }
      }

      // categories (comma)
      const catsRaw = String(fd.get('categories') || '');
      const names = catsRaw.split(',').map((s) => s.trim()).filter(Boolean);
      if (catsRaw.length >= 0) {
        await supabase.from('category_publication').delete().eq('pub_id', pubId);
        if (names.length) {
          const map = await getExistingCategoryIdsByName(names);
          const rows = Object.values(map).map((cid) => ({ pub_id: pubId, category_id: cid }));
          if (rows.length) await supabase.from('category_publication').insert(rows);
        }
      }

      // history (ส่งกลับ)
      const { data: logs } = await supabase
        .from('publication_edit_log')
        .select('edited_at, field_name, old_value, new_value, user:user_id(first_name, last_name, username)')
        .eq('pub_id', pubId)
        .order('edited_at', { ascending: false })
        .limit(50);

      const history = (logs || []).map((l: any) => ({
        edited_at: l.edited_at,
        field_name: l.field_name,
        old_value: l.old_value,
        new_value: l.new_value,
        user_name:
          `${l.user?.first_name ?? ''} ${l.user?.last_name ?? ''}`.trim() || l.user?.username || null,
      }));

      return NextResponse.json({
        ok: true,
        history,
        file_path: next_file_path ?? before.file_path ?? null,
        has_pdf: next_has_pdf ?? before.has_pdf ?? false,
      });
    }

    /* ---------- JSON ---------- */
    const body = await req.json();

    // สร้าง payload เฉพาะฟิลด์ที่ต้องอัปเดต
    const payload: Record<string, any> = {};
    if ('pub_name' in body || 'title_th' in body || '_extra_title_th' in body) {
      payload.pub_name = (String(body?.pub_name || body?.title_th || body?._extra_title_th || '')).trim() || null;
    }
    if ('venue_name' in body) payload.venue_name = String(body.venue_name || '').trim() || null;
    if ('level' in body) payload.level = body.level ?? null;
    if ('year' in body) payload.year = body.year ?? null;
    if ('has_pdf' in body) payload.has_pdf = !!body.has_pdf;
    if ('link_url' in body) payload.link_url = body.link_url ?? null;
    if ('venue_id' in body) {
      const v = Number(body.venue_id);
      payload.venue_id = Number.isFinite(v) ? v : null;
    }
    // status: อัปเดตเมื่อส่งมาจริงและไม่ว่าง
    if (typeof body?.status === 'string' && body.status.trim() !== '') {
      payload.status = body.status.trim();
    }

    // ----- abstract ops (JSON) -----
    let abstractTouched = false;
    if ('abstract' in body) {
      abstractTouched = true;
      const rep = typeof body.abstract === 'string' ? body.abstract : '';
      payload.abstract = rep.trim() ? rep : null;
    } else {
      let cur = String(before.abstract ?? '');
      let changed = false;

      if (typeof body.abstract_prepend === 'string') {
        cur = String(body.abstract_prepend) + cur;
        changed = true;
      }
      if (typeof body.abstract_append === 'string') {
        cur = cur + String(body.abstract_append);
        changed = true;
      }
      if (typeof body.abstract_delete === 'string' && body.abstract_delete) {
        const idx = cur.indexOf(body.abstract_delete);
        if (idx !== -1) {
          cur = cur.slice(0, idx) + cur.slice(idx + String(body.abstract_delete).length);
          changed = true;
        }
      }
      const s = Number(body.abstract_delete_from);
      const e = Number(body.abstract_delete_to);
      if (Number.isFinite(s) && Number.isFinite(e) && e >= s && s >= 0) {
        cur = cur.slice(0, s) + cur.slice(e);
        changed = true;
      }

      if (changed) {
        abstractTouched = true;
        payload.abstract = cur.trim() ? cur : null;
      }
    }

    payload.updated_at = new Date().toISOString();

    if (Object.keys(payload).length > 0) {
      const { error: uerr } = await supabase.from('publication').update(payload).eq('pub_id', pubId);
      if (uerr) throw uerr;
    }

    if ('status' in payload && !same((before as any).status, payload.status)) {
      await supabase.from('publication_status_history').insert({
        pub_id: pubId,
        user_id: me.user_id,
        changed_by: me.user_id,
        status: payload.status,
        note: null,
      });
    }

    // logs
    const changed: Array<{ field: string; old: any; val: any }> = [];
    for (const f of Object.keys(payload)) {
      if (f in before && !same((before as any)[f], payload[f])) {
        changed.push({ field: f, old: (before as any)[f], val: payload[f] });
      }
    }
    if (changed.length) {
      await supabase.from('publication_edit_log').insert(
        changed.map((c) => ({
          pub_id: pubId,
          user_id: me.user_id,
          field_name: c.field,
          old_value: c.old !== null ? String(c.old) : null,
          new_value: c.val !== null ? String(c.val) : null,
        }))
      );
    }

    // authors_json
    if (typeof body?.authors_json === 'string') {
      let arr: Array<{ full_name: string; email?: string | null; person_type?: string | null; role?: string | null; author_order?: number | null }> = [];
      try {
        const j = JSON.parse(body.authors_json);
        if (Array.isArray(j)) {
          arr = j.map((x: any, i: number) => ({
            full_name: String(x.full_name || '').trim(),
            email: x.email ? String(x.email) : null,
            person_type: x.person_type ? String(x.person_type) : null,
            role: x.role ? String(x.role) : null,
            author_order: Number(x.author_order) || i + 1,
          })).filter((x) => x.full_name.length > 0);
        }
      } catch {}
      await supabase.from('publication_person').delete().eq('pub_id', pubId);
      for (const a of arr) {
        const pid = await findOrInsertPerson({ full_name: a.full_name, email: a.email, person_type: a.person_type });
        await supabase.from('publication_person').insert({
          pub_id: pubId,
          person_id: pid,
          author_order: a.author_order,
          role: a.role,
        });
      }
    }

    // categories – ใช้เฉพาะที่มีอยู่
    if (Array.isArray(body?.categories) || typeof body?.categories === 'string') {
      const list: string[] = Array.isArray(body.categories)
        ? body.categories.map((s: string) => String(s))
        : String(body.categories).split(',').map((s) => s.trim());
      const map = await getExistingCategoryIdsByName(list);
      await supabase.from('category_publication').delete().eq('pub_id', pubId);
      const rows = Object.values(map).map((cid) => ({ pub_id: pubId, category_id: cid }));
      if (rows.length) await supabase.from('category_publication').insert(rows);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('professor patch error:', e?.message || e);
    return bad(e?.message || 'internal error', 500);
  }
}

/* ---------------- DELETE ---------------- */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getUser(req);
  if (!me) return bad('Unauthorized', 401);
  if (!canEdit(me.role)) return bad('Forbidden', 403);

  const pubId = Number(params.id);
  if (!Number.isFinite(pubId)) return bad('Invalid id');

  try {
    // ดึง file_path เพื่อลบไฟล์ใน storage
    const { data: pub, error } = await supabase
      .from('publication')
      .select('file_path')
      .eq('pub_id', pubId)
      .maybeSingle();
    if (error) throw error;
    if (!pub) return bad('Not found', 404);

    // ลบ relations
    await supabase.from('publication_person').delete().eq('pub_id', pubId);
    await supabase.from('category_publication').delete().eq('pub_id', pubId);
    await supabase.from('publication_edit_log').delete().eq('pub_id', pubId);
    await supabase.from('publication_status_history').delete().eq('pub_id', pubId);
    await supabase.from('review_action').delete().eq('pub_id', pubId);

    // ลบไฟล์
    if (pub.file_path) {
      await supabase.storage.from(BUCKET).remove([pub.file_path]);
    }

    // ลบ publication
    const { error: derr } = await supabase.from('publication').delete().eq('pub_id', pubId);
    if (derr) throw derr;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('professor delete error:', e?.message || e);
    return bad(e?.message || 'internal error', 500);
  }
}

export const dynamic = 'force-dynamic';
