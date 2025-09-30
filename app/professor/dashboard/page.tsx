// app/professor/dashboard/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type Row = {
  pub_id: number;
  pub_name: string | null;
  venue_name: string | null;
  level: string | null;
  year: number | null;
  status: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-700',
  under_review: 'bg-amber-100 text-amber-700',
  needs_revision: 'bg-indigo-100 text-indigo-700',
  published: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-zinc-100 text-zinc-500',
};

const ALL_LEVELS = ['NATIONAL', 'INTERNATIONAL'] as const;
const ALL_STATUSES = ['draft', 'under_review', 'needs_revision', 'published', 'archived'] as const;

type HasPdfOpt = 'any' | 'true' | 'false';
type PType = '' | 'JOURNAL' | 'CONFERENCE' | 'BOOK';

/* ---------- small hook: debounce ---------- */
function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* ---------- helpers: export filename ---------- */
function nowStamp() {
  const d = new Date();
  const pad = (n:number)=>String(n).padStart(2,'0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}
function defaultFilenameBase() {
  return `publications-report_${nowStamp()}`;
}
function sanitizeFilenameBase(name: string) {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, '_');
  return base || defaultFilenameBase();
}

export default function ProfessorDashboard() {
  const thisYear = new Date().getFullYear();

  // ===== Filters =====
  const [q, setQ] = useState('');
  const [author, setAuthor] = useState('');     // รองรับหลายชื่อคั่นด้วย ,
  const [catsText, setCatsText] = useState(''); // รองรับหลายหมวดคั่นด้วย ,
  const [ptype, setPtype] = useState<PType>('');
  const [yearFrom, setYearFrom] = useState<number>(thisYear - 2);
  const [yearTo, setYearTo] = useState<number>(thisYear);
  const [hasPdf, setHasPdf] = useState<HasPdfOpt>('any');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [levels, setLevels] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);

  // ===== Data / paging =====
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // ====== Debounced values ======
  const dq = useDebounced(q, 350);
  const dAuthor = useDebounced(author, 350);
  const dCats = useDebounced(catsText, 350);

  // ====== Suggest (Author) ======
  const [authorOpts, setAuthorOpts] = useState<string[]>([]);
  const [authorOpen, setAuthorOpen] = useState(false);
  const authorWrapRef = useRef<HTMLDivElement | null>(null);
  const authorCtrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = dAuthor.split(',').pop()?.trim() || '';

    authorCtrlRef.current?.abort();
    const ctrl = new AbortController();
    authorCtrlRef.current = ctrl;

    async function run() {
      if (term.length < 2) {
        setAuthorOpts([]);
        setAuthorOpen(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/professor/publications?suggest=author&q=${encodeURIComponent(term)}&limit=10`,
          { cache: 'no-store', signal: ctrl.signal }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || 'suggest failed');
        setAuthorOpts(json?.options || []);
        setAuthorOpen((json?.options || []).length > 0);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.error('author suggest error:', e);
        setAuthorOpts([]);
        setAuthorOpen(false);
      }
    }
    run();
    return () => ctrl.abort();
  }, [dAuthor]);

  function pickAuthor(opt: string) {
    const parts = author.split(',');
    parts[parts.length - 1] = opt; // แทนที่ token สุดท้าย
    const next = parts.map(s => s.trim()).filter(Boolean).join(', ');
    setAuthor(next);
    setAuthorOpen(false);
  }

  // click-outside close for author
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!authorWrapRef.current) return;
      if (!authorWrapRef.current.contains(e.target as Node)) {
        setAuthorOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // ====== Suggest (Categories) ======
  const [catOpts, setCatOpts] = useState<string[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const catWrapRef = useRef<HTMLDivElement | null>(null);
  const catCtrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const token = dCats.split(',').pop()?.trim() || '';

    catCtrlRef.current?.abort();
    const ctrl = new AbortController();
    catCtrlRef.current = ctrl;

    async function run() {
      if (token.length < 2) {
        setCatOpts([]);
        setCatOpen(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/professor/publications?suggest=category&q=${encodeURIComponent(token)}&limit=10`,
          { cache: 'no-store', signal: ctrl.signal }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || 'suggest failed');
        setCatOpts(json?.options || []);
        setCatOpen((json?.options || []).length > 0);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.error('category suggest error:', e);
        setCatOpts([]);
        setCatOpen(false);
      }
    }
    run();
    return () => ctrl.abort();
  }, [dCats]);

  function pickCategory(opt: string) {
    const parts = catsText.split(',');
    parts[parts.length - 1] = opt; // แทนที่ token สุดท้าย
    const uniq = Array.from(new Set(parts.map(s => s.trim()).filter(Boolean)));
    setCatsText(uniq.join(', '));
    setCatOpen(false);
  }

  // click-outside close for category
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!catWrapRef.current) return;
      if (!catWrapRef.current.contains(e.target as Node)) {
        setCatOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // ===== Main list fetch =====
  const ctrlRef = useRef<AbortController | null>(null);

  function toggleValue<T extends string>(list: T[], v: T, set: (x: T[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();

    p.set('mine', '1');
    p.set('leaderOnly', '1');

    if (dq.trim().length >= 2) p.set('q', dq.trim());
    if (dAuthor.trim().length >= 2) p.set('author', dAuthor.trim());

    const cats = dCats
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    cats.forEach((c) => p.append('cat', c));

    if (ptype) p.set('type', ptype);

    p.set('yearFrom', String(yearFrom));
    p.set('yearTo', String(yearTo));

    if (hasPdf === 'true') p.set('hasPdf', '1');
    if (hasPdf === 'false') p.set('hasPdf', '0');

    levels.forEach((lv) => p.append('level', lv));
    statuses.forEach((st) => p.append('status', st));

    p.set('page', String(page));
    p.set('pageSize', String(pageSize));

    return p;
  }, [dq, dAuthor, dCats, ptype, yearFrom, yearTo, hasPdf, levels, statuses, page]);

  useEffect(() => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    async function run() {
      setLoading(true);
      try {
        const res = await fetch(`/api/professor/publications?${queryParams.toString()}`, {
          cache: 'no-store',
          signal: ctrl.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = (json && (json.message || json.error)) || 'load failed';
          throw new Error(msg);
        }
        setRows(Array.isArray(json?.data) ? json.data : []);
        setTotal(Number(json?.total || 0));
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.error('load error:', e);
        setRows([]);
        setTotal(0);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }

    run();
    return () => ctrl.abort();
  }, [queryParams]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, dAuthor, dCats, ptype, yearFrom, yearTo, hasPdf, levels.join(','), statuses.join(',')]);

  function clearFilters() {
    setQ('');
    setAuthor('');
    setCatsText('');
    setPtype('');
    setYearFrom(thisYear - 2);
    setYearTo(thisYear);
    setHasPdf('any');
    setLevels([]);
    setStatuses([]);
    setShowAdvanced(false);
    setPage(1);
  }

  const hasActiveFilters =
    dq.trim().length >= 2 ||
    dAuthor.trim().length >= 2 ||
    dCats.trim().length > 0 ||
    !!ptype ||
    hasPdf !== 'any' ||
    levels.length > 0 ||
    statuses.length > 0 ||
    yearFrom !== thisYear - 2 ||
    yearTo !== thisYear;

  const summaryChips = [
    dq.trim().length >= 2 ? `คำค้น: “${dq}”` : null,
    dAuthor.trim().length >= 2 ? `ผู้แต่ง: “${dAuthor}”` : null,
    dCats ? `หมวดหมู่: ${dCats}` : null,
    ptype ? `ประเภท: ${ptype}` : null,
    hasPdf === 'true' ? 'มีไฟล์ PDF' : hasPdf === 'false' ? 'ไม่มีไฟล์ PDF' : null,
    (yearFrom !== thisYear - 2 || yearTo !== thisYear) ? `ช่วงปี: ${yearFrom}–${yearTo}` : null,
    levels.length ? `ระดับ: ${levels.join(', ')}` : null,
    statuses.length ? `สถานะ: ${statuses.join(', ')}` : null,
  ].filter(Boolean) as string[];

  const pageStart = (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, total);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // ===== params สำหรับรายงาน (ใช้เงื่อนไขเดียวกับหน้าจอ) =====
  const reportParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('mine', '1');
    p.set('leaderOnly', '1');
    if (dq.trim().length >= 2) p.set('q', dq.trim());
    if (dAuthor.trim().length >= 2) p.set('author', dAuthor.trim());
    dCats.split(',').map(s => s.trim()).filter(Boolean).forEach(c => p.append('cat', c));
    if (ptype) p.set('type', ptype);
    p.set('yearFrom', String(yearFrom));
    p.set('yearTo', String(yearTo));
    if (hasPdf === 'true') p.set('hasPdf', '1');
    if (hasPdf === 'false') p.set('hasPdf', '0');
    levels.forEach(lv => p.append('level', lv));
    statuses.forEach(st => p.append('status', st));
    return p;
  }, [dq, dAuthor, dCats, ptype, yearFrom, yearTo, hasPdf, levels, statuses]);

  // ===== Modal: กรอกชื่อไฟล์ก่อนดาวน์โหลด =====
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf'|'xlsx'>('pdf');
  const [exportName, setExportName] = useState<string>(defaultFilenameBase());
  const exportInputRef = useRef<HTMLInputElement|null>(null);

  function openExport(format: 'pdf'|'xlsx') {
    setExportFormat(format);
    setExportName(defaultFilenameBase());
    setExportOpen(true);
    setTimeout(() => exportInputRef.current?.focus(), 50);
  }

  async function confirmExport() {
    const base = sanitizeFilenameBase(exportName || '');
    await doExport(exportFormat, base);
    setExportOpen(false);
  }

  // --- ดาวน์โหลด PDF/XLSX ---
  async function doExport(format: 'pdf' | 'xlsx', filenameBase: string) {
    try {
      const p = new URLSearchParams(reportParams);
      p.set('format', format);
      p.set('filename', filenameBase);

      const res = await fetch(`/api/professor/publications/report?${p.toString()}`, { cache: 'no-store' });

      if (!res.ok) {
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (
          ct.includes('application/pdf') ||
          ct.includes('application/vnd.openxmlformats-officedocument') ||
          ct.includes('application/octet-stream')
        ) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const filename = filenameBase + (format === 'xlsx' ? '.xlsx' : '.pdf');
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
          return;
        }
        const txt = await res.text();
        try {
          const j = JSON.parse(txt);
          throw new Error(j?.message || 'export failed');
        } catch {
          throw new Error(txt || `export failed (HTTP ${res.status})`);
        }
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const filename = filenameBase + (format === 'xlsx' ? '.xlsx' : '.pdf');

      if (format === 'pdf') {
        const w = window.open(url, '_blank', 'noopener,noreferrer');
        if (!w || w.closed || typeof w.closed === 'undefined') {
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e:any) {
      console.error('export error:', e);
      alert(e?.message || 'export failed');
    }
  }

  return (
    <div className="space-y-4">
      {/* ===== แถบค้นหา ===== */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-7">
            <label className="text-xs text-gray-500 mb-1 block">คำค้นหา</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="พิมพ์คำค้นหา: ชื่อผลงาน, DOI, แหล่งตีพิมพ์... (อย่างน้อย 2 ตัวอักษร)"
              className="w-full border rounded-xl px-3 py-2"
            />
          </div>

          {/* ===== Author with suggest ===== */}
          <div className="relative col-span-12 md:col-span-5" ref={authorWrapRef}>
            <label className="text-xs text-gray-500 mb-1 block">ชื่ออาจารย์ / ผู้แต่ง</label>
            <input
              value={author}
              onChange={(e) => { setAuthor(e.target.value); setAuthorOpen(true); }}
              onFocus={() => { if (authorOpts.length) setAuthorOpen(true); }}
              placeholder="เช่น Somchai หรือ Somchai, Suda (อย่างน้อย 2 ตัวอักษร)"
              className="w-full border rounded-xl px-3 py-2"
            />
            {authorOpen && authorOpts.length > 0 && (
              <div className="absolute left-0 right-0 z-50 mt-1 w-full bg-white border rounded-xl shadow max-h-56 overflow-auto">
                {authorOpts.map((opt) => (
                  <button
                    key={opt}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickAuthor(opt)}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-50"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-3">
            <label className="text-xs text-gray-500 mb-1 block">ประเภท</label>
            <select
              value={ptype}
              onChange={(e) => setPtype(e.target.value as PType)}
              className="w-full border rounded-xl px-3 py-2"
            >
              <option value="">ทั้งหมด</option>
              <option value="JOURNAL">JOURNAL</option>
              <option value="CONFERENCE">CONFERENCE</option>
              <option value="BOOK">BOOK</option>
            </select>
          </div>

          {/* ===== Categories with suggest ===== */}
          <div className="relative col-span-12 md:col-span-5" ref={catWrapRef}>
            <label className="text-xs text-gray-500 mb-1 block">หมวดหมู่ (คั่นด้วย ,)</label>
            <input
              value={catsText}
              onChange={(e) => { setCatsText(e.target.value); setCatOpen(true); }}
              onFocus={() => { if (catOpts.length) setCatOpen(true); }}
              placeholder="เช่น Data Science, Software Engineering"
              className="w-full border rounded-xl px-3 py-2"
            />
            {catOpen && catOpts.length > 0 && (
              <div className="absolute left-0 right-0 z-50 mt-1 w-full bg-white border rounded-xl shadow max-h-56 overflow-auto">
                {catOpts.map((opt) => (
                  <button
                    key={opt}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickCategory(opt)}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-50"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            <div className="text-[11px] text-gray-400 mt-1">
              * หมายเหตุ: ถ้าระบุหลายหมวด ระบบจะค้นหา “ผลงานที่มีครบทุกหมวดที่ระบุ”
            </div>
          </div>

          <div className="col-span-6 md:col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">ปี (จาก)</label>
            <input
              type="number"
              value={yearFrom}
              onChange={(e) => setYearFrom(Number(e.target.value || thisYear))}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="2019"
            />
          </div>
          <div className="col-span-6 md:col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">ปี (ถึง)</label>
            <input
              type="number"
              value={yearTo}
              onChange={(e) => setYearTo(Number(e.target.value || thisYear))}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="2025"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">ไฟล์ PDF:</span>
            <div className="inline-flex rounded-lg border overflow-hidden">
              <button
                className={`px-3 py-1.5 text-sm ${hasPdf === 'any' ? 'bg-gray-900 text-white' : 'bg-white'}`}
                onClick={() => setHasPdf('any')}
              >
                ทั้งหมด
              </button>
              <button
                className={`px-3 py-1.5 text-sm border-l ${hasPdf === 'true' ? 'bg-gray-900 text-white' : 'bg-white'}`}
                onClick={() => setHasPdf('true')}
              >
                มีไฟล์
              </button>
              <button
                className={`px-3 py-1.5 text-sm border-l ${hasPdf === 'false' ? 'bg-gray-900 text-white' : 'bg-white'}`}
                onClick={() => setHasPdf('false')}
              >
                ไม่มีไฟล์
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <div className="hidden md:flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                {summaryChips.map((s, i) => (
                  <span key={i} className="inline-flex items-center bg-gray-100 border rounded-full px-2 py-0.5">
                    {s}
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="px-3 py-2 rounded-xl border bg-white text-sm"
            >
              {showAdvanced ? 'ซ่อนตัวกรองขั้นสูง' : 'ตัวกรองขั้นสูง'}
            </button>

            <button onClick={clearFilters} className="px-3 py-2 rounded-xl border bg-white text-sm">
              ล้างตัวกรอง
            </button>

            {/* ===== ปุ่มรายงาน (ไม่มีพรีวิว) ===== */}
            <button
              onClick={() => openExport('pdf')}
              className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700"
              title="ออกรายงานเป็น PDF"
            >
              ออกรายงาน PDF
            </button>
            <button
              onClick={() => openExport('xlsx')}
              className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm hover:bg-indigo-700"
              title="ออกรายงานเป็น Excel"
            >
              ออกรายงาน Excel
            </button>

            <Link
              href="/professor/publications/new"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm hover:bg-emerald-700"
            >
              + สร้างผลงานใหม่
            </Link>
          </div>
        </div>

        {showAdvanced && (
          <div className="mt-3 grid grid-cols-12 gap-3">
            <div className="col-span-12">
              <div className="text-xs text-gray-500 mb-1">ระดับ</div>
              <div className="flex flex-wrap gap-2">
                {ALL_LEVELS.map((lv) => {
                  const active = levels.includes(lv);
                  return (
                    <button
                      key={lv}
                      onClick={() => toggleValue(levels, lv, setLevels)}
                      className={`px-3 py-1.5 rounded-lg text-xs border ${
                        active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'
                      }`}
                      aria-pressed={active}
                    >
                      {lv}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="col-span-12">
              <div className="text-xs text-gray-500 mb-1">สถานะ</div>
              <div className="flex flex-wrap gap-2">
                {ALL_STATUSES.map((st) => {
                  const active = statuses.includes(st);
                  return (
                    <button
                      key={st}
                      onClick={() => toggleValue(statuses, st, setStatuses)}
                      className={`px-3 py-1.5 rounded-lg text-xs border ${
                        active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-700'
                      }`}
                      aria-pressed={active}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== ตารางผลลัพธ์ ===== */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3">ชื่อผลงาน</th>
                <th className="px-3 py-3">ระดับ</th>
                <th className="px-3 py-3">ปี</th>
                <th className="px-3 py-3">สถานะ</th>
                <th className="px-3 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">กำลังโหลด...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">ไม่พบรายการ</td>
                </tr>
              ) : (
                rows.map((r) => {
                  const name = (r.pub_name || '').trim();
                  const venue = (r.venue_name || '').trim();
                  const displayTitle = name || venue || `#${r.pub_id}`;
                  const showVenueLine = !!venue && (!!name ? venue.toLowerCase() !== name.toLowerCase() : true);
                  const st = (r.status || 'draft').toLowerCase();
                  const badgeClass = STATUS_STYLE[st] || 'bg-zinc-100 text-zinc-700';
                  return (
                    <tr key={r.pub_id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{displayTitle}</div>
                        {showVenueLine && <div className="text-xs text-zinc-500">{venue}</div>}
                      </td>
                      <td className="px-3 py-3">{r.level || '-'}</td>
                      <td className="px-3 py-3">{Number.isFinite(r.year as any) ? r.year : '-'}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full ${badgeClass}`}>{r.status || 'draft'}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <Link href={`/professor/publications/${r.pub_id}?from=dashboard`} className="px-2.5 py-1.5 text-xs rounded-lg border hover:bg-zinc-50">
                            ดู
                          </Link>
                          <Link href={`/professor/publications/${r.pub_id}/edit`} className="px-2.5 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                            แก้ไข
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <PaginationFooter total={total} page={page} pageSize={pageSize} onPageChange={setPage} />
      </div>

      {/* ===== Modal: ตั้งชื่อไฟล์ก่อนดาวน์โหลด ===== */}
      {exportOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-3">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-semibold">ตั้งชื่อไฟล์สำหรับดาวน์โหลด</div>
              <span className="text-xs text-gray-500 uppercase">{exportFormat === 'pdf' ? 'PDF' : 'Excel'}</span>
            </div>
            <div className="p-4 space-y-3">
              <label className="text-xs text-gray-500">ชื่อไฟล์ (ไม่ต้องใส่นามสกุล)</label>
              <input
                ref={exportInputRef}
                value={exportName}
                onChange={(e)=>setExportName(e.target.value)}
                className="w-full border rounded-xl px-3 py-2"
                placeholder={defaultFilenameBase()}
                onKeyDown={(e)=>{ if(e.key==='Enter') confirmExport(); }}
              />
              <div className="text-[11px] text-gray-500">
                ระบบจะเติมนามสกุลให้เอง: {exportFormat === 'pdf' ? '.pdf' : '.xlsx'}
              </div>
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button onClick={()=>setExportOpen(false)} className="px-3 py-2 rounded-lg border text-sm">
                ยกเลิก
              </button>
              <button onClick={confirmExport} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">
                ดาวน์โหลด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaginationFooter({
  total,
  page,
  pageSize,
  onPageChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const pageStart = (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, total);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm text-gray-600">
      <div>{total > 0 ? <>แสดง {pageStart}-{pageEnd} จาก {total} รายการ</> : <>ไม่มีข้อมูล</>}</div>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-3 py-1 rounded-lg border disabled:opacity-50"
        >
          ก่อนหน้า
        </button>
        <div className="px-2 py-1">หน้า {page} / {pageCount}</div>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={pageEnd >= total}
          className="px-3 py-1 rounded-lg border disabled:opacity-50"
        >
          หน้าถัดไป
        </button>
      </div>
    </div>
  );
}
