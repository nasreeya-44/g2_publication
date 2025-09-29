// app/api/professor/publications/report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server-only key
);

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

function intersectSets(a: Set<number>, b: Set<number>) {
  const out = new Set<number>();
  for (const x of a) if (b.has(x)) out.add(x);
  return out;
}

// ตัดคำตามความกว้างจริงของฟอนต์
function wrapByWidth(text: string, maxWidth: number, font: any, size: number) {
  const words = (text || '').split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = (cur ? cur + ' ' : '') + w;
    const width = font.widthOfTextAtSize(trial, size);
    if (width > maxWidth) {
      if (cur) lines.push(cur);
      // ถ้าคำเดี่ยว ๆ กว้างเกิน ให้ตัดเป็นตัว ๆ
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        let buf = '';
        for (const ch of w) {
          const t2 = buf + ch;
          if (font.widthOfTextAtSize(t2, size) > maxWidth) {
            if (buf) lines.push(buf);
            buf = ch;
          } else {
            buf = t2;
          }
        }
        cur = buf;
      } else {
        cur = w;
      }
    } else {
      cur = trial;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function GET(req: NextRequest) {
  try {
    const me = await getUserFromCookie(req);
    if (!me) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (!(me.role === 'PROFESSOR' || me.role === 'ADMIN')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);

    // ===== เงื่อนไขเหมือนหน้าจัดการ =====
    const q = (searchParams.get('q') || '').trim();

    const levels = [
      ...searchParams.getAll('level'),
      ...searchParams.getAll('levels'),
    ].map(s => s.trim().toUpperCase()).filter(Boolean);

    const statuses = [
      ...searchParams.getAll('status'),
      ...searchParams.getAll('statuses'),
    ].map(s => s.trim().toLowerCase()).filter(Boolean);

    const yearFrom = toInt(searchParams.get('yearFrom') ?? searchParams.get('year_from'));
    const yearTo   = toInt(searchParams.get('yearTo')   ?? searchParams.get('year_to'));

    const hasPdfParam = (() => {
      const v = (searchParams.get('hasPdf') ?? searchParams.get('has_pdf') ?? '').toLowerCase();
      if (['1', 'true', 'yes', 'on'].includes(v)) return true;
      if (['0', 'false', 'no', 'off'].includes(v)) return false;
      return null as null | boolean;
    })();

    const onlyMine   = searchParams.get('mine') === '1';
    const leaderOnly = searchParams.get('leaderOnly') === '1';
    const typeQ = (searchParams.get('type') || searchParams.get('ptype') || searchParams.get('venueType') || '').trim();

    // ผู้แต่ง AND
    const authorRaw = (searchParams.get('author')?.trim() || searchParams.get('author_name')?.trim() || '');
    const authorTerms = authorRaw.split(',').map(s => s.trim()).filter(Boolean);

    // หมวดหมู่ AND
    const catsMulti = searchParams.getAll('cat').map(s => s.trim()).filter(Boolean);
    const catsFromComma = (searchParams.get('categories') || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const catTerms = Array.from(new Set([...catsMulti, ...catsFromComma]));

    const page     = Math.max(1, toInt(searchParams.get('page'), 1)!);
    const pageSize = Math.min(1000, Math.max(1, toInt(searchParams.get('pageSize'), 500)!));
    const from     = (page - 1) * pageSize;
    const to       = from + pageSize - 1;

    // ===== คำนวณ pub_id ย่อย =====
    let pubIdsMine: number[] | null = null;
    if (onlyMine) {
      const { data: myPersons, error: e1 } = await supabase
        .from('person')
        .select('person_id')
        .eq('user_id', me.user_id);
      if (e1) throw e1;
      const myPersonIds = (myPersons || []).map((x: any) => x.person_id);
      if (!myPersonIds.length) {
        // ไม่มี person mapping
        return new NextResponse(await buildEmptyPdf(), {
          headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="publications-report.pdf"' },
        });
      }

      let qMine = supabase.from('publication_person').select('pub_id, role, person_id');
      qMine = qMine.in('person_id', myPersonIds);
      if (leaderOnly) qMine = qMine.eq('role', 'LEAD');
      const { data: pp, error: e2 } = await qMine;
      if (e2) throw e2;
      pubIdsMine = (pp || []).map((x: any) => x.pub_id);
      if (!pubIdsMine.length) {
        return new NextResponse(await buildEmptyPdf(), {
          headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="publications-report.pdf"' },
        });
      }
    }

    // AND: authors
    let pubIdsByAuthor: number[] | null = null;
    if (authorTerms.length) {
      let acc: Set<number> | null = null;
      for (const term of authorTerms) {
        const { data: persons, error: perr } = await supabase
          .from('person')
          .select('person_id')
          .ilike('full_name', `%${term}%`);
        if (perr) throw perr;
        const personIds = (persons || []).map((p: any) => p.person_id);
        if (!personIds.length) {
          return new NextResponse(await buildEmptyPdf(), {
            headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="publications-report.pdf"' },
          });
        }

        const { data: ppubs, error: pperr } = await supabase
          .from('publication_person')
          .select('pub_id')
          .in('person_id', personIds);
        if (pperr) throw pperr;

        const thisSet = new Set((ppubs || []).map((x: any) => x.pub_id));
        if (!thisSet.size) {
          return new NextResponse(await buildEmptyPdf(), {
            headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="publications-report.pdf"' },
          });
        }

        acc = acc ? intersectSets(acc, thisSet) : thisSet;
        if (!acc.size) {
          return new NextResponse(await buildEmptyPdf(), {
            headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="publications-report.pdf"' },
          });
        }
      }
      pubIdsByAuthor = Array.from(acc!);
    }

    // AND: categories
    let pubIdsByCategory: number[] | null = null;
    if (catTerms.length) {
      let acc: Set<number> | null = null;
      for (const term of catTerms) {
        const { data: cats, error: cErr } = await supabase
          .from('category')
          .select('category_id')
          .eq('status', 'ACTIVE')
          .ilike('category_name', `%${term}%`);
        if (cErr) throw cErr;
        const catIds = (cats || []).map((c: any) => c.category_id);
        if (!catIds.length) {
          return new NextResponse(await buildEmptyPdf(), {
            headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="publications-report.pdf"' },
          });
        }

        const { data: cp, error: cpErr } = await supabase
          .from('category_publication')
          .select('pub_id')
          .in('category_id', catIds);
        if (cpErr) throw cpErr;

        const thisSet = new Set((cp || []).map((x: any) => x.pub_id));
        if (!thisSet.size) {
          return new NextResponse(await buildEmptyPdf(), {
            headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="publications-report.pdf"' },
          });
        }

        acc = acc ? intersectSets(acc, thisSet) : thisSet;
        if (!acc.size) {
          return new NextResponse(await buildEmptyPdf(), {
            headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="publications-report.pdf"' },
          });
        }
      }
      pubIdsByCategory = Array.from(acc!);
    }

    // venue by type
    let venueIdsByType: number[] | null = null;
    if (typeQ) {
      const { data: venues, error: vErr } = await supabase
        .from('venue')
        .select('venue_id')
        .ilike('type', `%${typeQ}%`);
      if (vErr) throw vErr;
      venueIdsByType = (venues || []).map((v: any) => v.venue_id);
      if (!venueIdsByType.length) {
        return new NextResponse(await buildEmptyPdf(), {
          headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="publications-report.pdf"' },
        });
      }
    }

    // ===== main query =====
    let query = supabase
      .from('publication')
      .select('pub_id, pub_name, venue_name, venue_id, level, year, status, has_pdf, link_url', { count: 'exact' });

    if (q) {
      query = query.or(`pub_name.ilike.%${q}%,venue_name.ilike.%${q}%,link_url.ilike.%${q}%`);
    }
    if (levels.length)   query = query.in('level', levels);
    if (statuses.length) query = query.in('status', statuses);

    if (yearFrom != null) query = query.gte('year', yearFrom);
    if (yearTo   != null) query = query.lte('year', yearTo);

    if (hasPdfParam === true)  query = query.eq('has_pdf', true);
    if (hasPdfParam === false) query = query.eq('has_pdf', false);

    if (onlyMine && pubIdsMine) query = query.in('pub_id', pubIdsMine);
    if (pubIdsByAuthor)         query = query.in('pub_id', pubIdsByAuthor);
    if (pubIdsByCategory)       query = query.in('pub_id', pubIdsByCategory);
    if (venueIdsByType)         query = query.in('venue_id', venueIdsByType);

    query = query.order('year', { ascending: false }).order('pub_id', { ascending: false }).range(from, to);

    const { data: pubs, error: qerr, count } = await query;
    if (qerr) throw qerr;

    const rows = (pubs || []).map((p: any) => ({
      pub_id: p.pub_id,
      pub_name: p.pub_name ?? null,
      venue_name: p.venue_name ?? null,
      level: p.level ?? null,
      year: p.year ?? null,
      status: p.status ?? null,
      link_url: p.link_url ?? null,
      has_pdf: !!p.has_pdf,
    }));

    // ===== โหลดฟอนต์ไทย =====
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Sarabun-Regular.ttf');
    const fontBoldPath = path.join(process.cwd(), 'public', 'fonts', 'Sarabun-Bold.ttf');

    let fontBytes: Uint8Array, fontBoldBytes: Uint8Array;
    try {
      fontBytes = await fs.readFile(fontPath);
      fontBoldBytes = await fs.readFile(fontBoldPath);
    } catch (e) {
      console.error('Thai font files not found in /public/fonts', e);
      return NextResponse.json(
        { message: 'Thai font files not found. Please put Sarabun-Regular.ttf and Sarabun-Bold.ttf in /public/fonts' },
        { status: 500 }
      );
    }

    // ===== สร้าง PDF + register fontkit =====
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const font = await pdfDoc.embedFont(fontBytes, { subset: true });
    const fontBold = await pdfDoc.embedFont(fontBoldBytes, { subset: true });

    const PAGE_W = 595.28; // A4 portrait
    const PAGE_H = 841.89;
    const M = 40;
    const LINE = 16;
    const maxTextWidth = PAGE_W - M * 2;

    let pg = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - M;

    const drawLine = (txt: string, opts: { bold?: boolean; size?: number; color?: any } = {}) => {
      const size = opts.size ?? 11;
      const usedFont = opts.bold ? fontBold : font;
      const lines = wrapByWidth(txt, maxTextWidth, usedFont, size);
      for (const l of lines) {
        pg.drawText(l, { x: M, y, size, font: usedFont, color: opts.color ?? rgb(0,0,0) });
        y -= LINE;
        if (y < M + 60) {
          pg = pdfDoc.addPage([PAGE_W, PAGE_H]);
          y = PAGE_H - M;
        }
      }
    };

    // Header
    drawLine('รายงานผลงานตีพิมพ์', { bold: true, size: 16 });
    drawLine(`ผู้ใช้: ${me.username}  วันที่พิมพ์: ${new Date().toLocaleString()}`, { size: 10, color: rgb(0.2,0.2,0.2) });
    y -= 6;

    // สรุปตัวกรอง
    const chips: string[] = [];
    if (q) chips.push(`คำค้น="${q}"`);
    if (levels.length) chips.push(`ระดับ=${levels.join('|')}`);
    if (statuses.length) chips.push(`สถานะ=${statuses.join('|')}`);
    if (yearFrom != null || yearTo != null) chips.push(`ปี=${yearFrom ?? '-'}–${yearTo ?? '-'}`);
    if (hasPdfParam === true) chips.push('มีไฟล์ PDF');
    if (hasPdfParam === false) chips.push('ไม่มีไฟล์ PDF');
    if (authorTerms.length) chips.push(`ผู้แต่ง=${authorTerms.join(' & ')}`);
    if (catTerms.length) chips.push(`หมวดหมู่=${catTerms.join(' & ')}`);
    if (typeQ) chips.push(`ประเภท=${typeQ}`);
    if (onlyMine) chips.push(leaderOnly ? 'เฉพาะงานที่เป็นหัวหน้า (ของฉัน)' : 'เฉพาะงานของฉัน');

    const chipsText = chips.length ? `ตัวกรอง: ${chips.join(' | ')}` : 'ตัวกรอง: (ทั้งหมด)';
    drawLine(chipsText, { size: 10, color: rgb(0.25,0.25,0.25) });
    y -= 4;

    drawLine(`จำนวนรายการ: ${count ?? rows.length}`, { size: 10, color: rgb(0.15,0.15,0.15) });
    y -= 4;

    // รายการ
    const drawItem = (idx: number, r: any) => {
      const title = (r.pub_name || r.venue_name || `#${r.pub_id}`).trim();
      const parts = [
        r.venue_name && r.venue_name !== r.pub_name ? `แหล่งตีพิมพ์: ${r.venue_name}` : null,
        r.level ? `ระดับ: ${r.level}` : null,
        Number.isFinite(r.year) ? `ปี: ${r.year}` : null,
        r.status ? `สถานะ: ${r.status}` : null,
        r.link_url ? `ลิงก์: ${r.link_url}` : null,
        r.has_pdf ? 'PDF: มี' : 'PDF: ไม่มี',
      ].filter(Boolean);

      drawLine(`${idx}. ${title}`, { bold: true, size: 12 });
      if (parts.length) drawLine(parts.join('  |  '), { size: 11 });
      y -= 2;
    };

    rows.forEach((r, i) => drawItem(from + i + 1, r));

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="publications-report.pdf"`,
        'Cache-Control': 'no-store',
      },
    });

  } catch (err: any) {
    console.error('report pdf error:', err?.message || err);
    return NextResponse.json({ message: err?.message || 'internal error' }, { status: 500 });
  }
}

// ใช้เมื่อไม่มีข้อมูล ให้คืน PDF หน้าเดียวที่มีข้อความกำกับ
async function buildEmptyPdf() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // โหลดฟอนต์แบบ try/catch เผื่อไม่มีฟอนต์ — จะย้อนกลับไปใช้ standard font (จะไม่รองรับไทยเต็มที่)
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const M = 40;

  let fontBytes: Uint8Array | null = null;
  try {
    fontBytes = await fs.readFile(path.join(process.cwd(), 'public', 'fonts', 'Sarabun-Regular.ttf'));
  } catch {}
  const font = fontBytes ? await pdfDoc.embedFont(fontBytes, { subset: true }) : undefined;

  const pg = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const text = 'ไม่พบข้อมูลตามเงื่อนไขที่ระบุ';
  if (font) {
    pg.drawText(text, { x: M, y: PAGE_H - M - 16, size: 12, font, color: rgb(0,0,0) });
  } else {
    // fallback (อาจแสดงเป็นสี่เหลี่ยมถ้าไม่มีฟอนต์ไทย)
    pg.drawText('No data', { x: M, y: PAGE_H - M - 16, size: 12, color: rgb(0,0,0) });
  }

  return pdfDoc.save();
}
