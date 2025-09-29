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

  // ===== Main list fetch (with AbortController) =====
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

  // ===== รายงาน: พรีวิว + ดาวน์โหลด PDF (อิงเงื่อนไขเดียวกับฟอร์ม) =====
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportRows, setReportRows] = useState<any[]>([]);
  const [reportErr, setReportErr] = useState<string | null>(null);

  // params สำหรับรายงาน — ใช้ฟิลเตอร์เหมือนหน้าจอ แต่ "ไม่ใส่ page/pageSize" เพื่อดึงทั้งหมดตามเงื่อนไข
  const reportParams = useMemo(() => {
    const p = new URLSearchParams();

    // ยึดตามหน้าจัดการ (ของตนเอง + หัวหน้า)
    p.set('mine', '1');
    p.set('leaderOnly', '1');

    if (dq.trim().length >= 2) p.set('q', dq.trim());
    if (dAuthor.trim().length >= 2) p.set('author', dAuthor.trim());

    const cats = dCats.split(',').map(s => s.trim()).filter(Boolean);
    cats.forEach(c => p.append('cat', c));

    if (ptype) p.set('type', ptype);
    p.set('yearFrom', String(yearFrom));
    p.set('yearTo', String(yearTo));

    if (hasPdf === 'true') p.set('hasPdf', '1');
    if (hasPdf === 'false') p.set('hasPdf', '0');

    levels.forEach(lv => p.append('level', lv));
    statuses.forEach(st => p.append('status', st));

    return p;
  }, [dq, dAuthor, dCats, ptype, yearFrom, yearTo, hasPdf, levels, statuses]);

  // --- พรีวิวรายงาน: บังคับให้แบ็กเอนด์ส่ง JSON (ถ้ารองรับ format=json) มิฉะนั้นตรวจ content-type ---
  async function openPreview() {
    setReportOpen(true);
    setReportLoading(true);
    setReportErr(null);
    try {
      const p = new URLSearchParams(reportParams);
      // ถ้าแบ็กเอนด์รองรับ format=json ให้บังคับไว้เพื่อกันพลาด
      p.set('format', 'json');

      const res = await fetch(`/api/professor/publications/report?${p.toString()}`, { cache: 'no-store' });

      if (!res.ok) {
        // พยายามอ่านข้อความผิดพลาดแบบปลอดภัย
        const txt = await res.text();
        try {
          const j = JSON.parse(txt);
          throw new Error(j?.message || 'load preview failed');
        } catch {
          throw new Error(txt || 'load preview failed');
        }
      }

      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/pdf')) {
        // เซิร์ฟเวอร์ส่ง PDF มาแทน -> เปิดดูในแท็บ
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setReportRows([]);
        setReportErr(null);
      } else if (ct.includes('application/json')) {
        const json = await res.json();
        setReportRows(Array.isArray(json?.data) ? json.data : []);
      } else {
        // ฟอร์แมตอื่น ๆ -> ลองเปิดแท็บใหม่
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (e: any) {
      console.error('report preview error:', e);
      setReportRows([]);
      setReportErr(e?.message || 'failed');
    } finally {
      setReportLoading(false);
    }
  }

  // --- ดาวน์โหลด PDF: อ่านเป็น blob เสมอ ไม่ parse JSON ---
  async function downloadPdf() {
    try {
      const p = new URLSearchParams(reportParams);
      p.set('format', 'pdf');

      const res = await fetch(`/api/professor/publications/report?${p.toString()}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        const txt = await res.text();
        try {
          const j = JSON.parse(txt);
          throw new Error(j?.message || 'download failed');
        } catch {
          throw new Error(txt || 'download failed');
        }
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // พยายามให้เปิดในแท็บใหม่ก่อน (บางเบราว์เซอร์จะพรีวิว PDF ได้)
      const w = window.open(url, '_blank');
      if (!w || w.closed || typeof w.closed === 'undefined') {
        // ถ้า pop-up ถูกบล็อก ให้ fallback เป็นดาวน์โหลดไฟล์
        const a = document.createElement('a');
        a.href = url;
        a.download = 'publication-report.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      // cleanup
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e: any) {
      console.error('download report error:', e);
      alert(e?.message || 'download failed');
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

            {/* ===== ปุ่มรายงาน ===== */}
            <button
              onClick={openPreview}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm hover:bg-emerald-700"
            >
              พรีวิวรายงาน
            </button>
            <button
              onClick={downloadPdf}
              className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700"
              title="ออกรายงานเป็น PDF"
            >
              ดาวน์โหลด PDF
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

      {/* ===== Modal พรีวิวรายงาน ===== */}
      {reportOpen && (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-semibold">พรีวิวรายงาน (อิงเงื่อนไขจากฟอร์มค้นหา)</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadPdf}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                >
                  ดาวน์โหลด PDF
                </button>
                <button
                  onClick={()=>setReportOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-sm"
                >
                  ปิด
                </button>
              </div>
            </div>

            <div className="p-3 overflow-auto">
              {reportLoading ? (
                <div className="text-sm text-gray-600">กำลังโหลด...</div>
              ) : reportErr ? (
                <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {reportErr}
                </div>
              ) : reportRows.length === 0 ? (
                <div className="text-sm text-gray-600">ไม่พบข้อมูลตามเงื่อนไข</div>
              ) : (
                <ol className="space-y-4 list-decimal pl-5">
                  {reportRows.map((r:any) => (
                    <li key={r.pub_id}>
                      <div className="font-medium">{r.pub_name || r.venue_name || '(ไม่มีชื่อเรื่อง)'}</div>
                      {r.venue_name && r.venue_name !== r.pub_name && (
                        <div className="text-sm text-gray-600">Venue: {r.venue_name}</div>
                      )}
                      <div className="text-sm text-gray-600">
                        ระดับ: {r.level || '-'} · ปี: {r.year ?? '-'} · สถานะ: {r.status || '-'}
                      </div>
                      {Array.isArray(r.authors) && r.authors.length > 0 && (
                        <div className="text-sm">ผู้แต่ง: {r.authors.join(', ')}</div>
                      )}
                      {Array.isArray(r.categories) && r.categories.length > 0 && (
                        <div className="text-sm">หมวดหมู่: {r.categories.join(', ')}</div>
                      )}
                      {r.link_url && <div className="text-sm">ลิงก์: {r.link_url}</div>}
                    </li>
                  ))}
                </ol>
              )}
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
