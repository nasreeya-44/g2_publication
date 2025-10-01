// app/professor/publications/page.tsx
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
type HasPdfOpt = 'any' | 'true' | 'false';
type PType = '' | 'JOURNAL' | 'CONFERENCE' | 'BOOK';

/* ---------- debounce hook ---------- */
function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function ProfessorAllPublicationsPage() {
  const thisYear = new Date().getFullYear();

  // ===== Filters (เหมือนหน้า Dashboard แต่ไม่มีสถานะ และไม่ limit เฉพาะ mine) =====
  const [q, setQ] = useState('');
  const [author, setAuthor] = useState('');     // รองรับหลายชื่อ คั่น ,
  const [catsText, setCatsText] = useState(''); // รองรับหลายหมวด คั่น ,
  const [ptype, setPtype] = useState<PType>('');
  const [yearFrom, setYearFrom] = useState<number | ''>('');
  const [yearTo, setYearTo] = useState<number | ''>('');
  const [hasPdf, setHasPdf] = useState<HasPdfOpt>('any');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [levels, setLevels] = useState<string[]>([]);

  // ===== Data / paging =====
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // ===== Debounced =====
  const dq = useDebounced(q, 350);
  const dAuthor = useDebounced(author, 350);
  const dCats = useDebounced(catsText, 350);

  // ===== Suggest: Author =====
  const [authorOpts, setAuthorOpts] = useState<string[]>([]);
  const [authorOpen, setAuthorOpen] = useState(false);
  const authorWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const term = dAuthor.split(',').pop()?.trim() || '';
    let aborted = false;
    async function run() {
      if (term.length < 2) {
        setAuthorOpts([]); setAuthorOpen(false);
        return;
      }
      try {
        const res = await fetch(`/api/professor/publications?suggest=author&q=${encodeURIComponent(term)}&limit=10`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || 'suggest failed');
        if (!aborted) {
          setAuthorOpts(json?.options || []);
          setAuthorOpen((json?.options || []).length > 0);
        }
      } catch (e) {
        if (!aborted) {
          console.error('author suggest error:', e);
          setAuthorOpts([]); setAuthorOpen(false);
        }
      }
    }
    run();
    return () => { aborted = true; };
  }, [dAuthor]);
  function pickAuthor(opt: string) {
    const parts = author.split(',');
    parts[parts.length - 1] = opt;
    const next = parts.map(s => s.trim()).filter(Boolean).join(', ');
    setAuthor(next);
    setAuthorOpen(false);
  }
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

  // ===== Suggest: Category =====
  const [catOpts, setCatOpts] = useState<string[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const catWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const token = dCats.split(',').pop()?.trim() || '';
    let aborted = false;
    async function run() {
      if (token.length < 2) {
        setCatOpts([]); setCatOpen(false);
        return;
      }
      try {
        const res = await fetch(`/api/professor/publications?suggest=category&q=${encodeURIComponent(token)}&limit=10`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || 'suggest failed');
        if (!aborted) {
          setCatOpts(json?.options || []);
          setCatOpen((json?.options || []).length > 0);
        }
      } catch (e) {
        if (!aborted) {
          console.error('category suggest error:', e);
          setCatOpts([]); setCatOpen(false);
        }
      }
    }
    run();
    return () => { aborted = true; };
  }, [dCats]);
  function pickCategory(opt: string) {
    const parts = catsText.split(',');
    parts[parts.length - 1] = opt;
    const uniq = Array.from(new Set(parts.map(s => s.trim()).filter(Boolean)));
    setCatsText(uniq.join(', '));
    setCatOpen(false);
  }
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

  // ===== Utilities =====
  function toggleValue<T extends string>(list: T[], v: T, set: (x: T[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  // ===== Build query =====
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();

    // ✅ ฟอร์มนี้ “ผลงานทั้งหมด” ไม่บังคับ mine/leaderOnly
    // ✅ บังคับสถานะ published เสมอ
    p.set('status', 'published');

    if (dq.trim().length >= 2) p.set('q', dq.trim());
    if (dAuthor.trim().length >= 2) p.set('author', dAuthor.trim());

    const cats = dCats.split(',').map(s => s.trim()).filter(Boolean);
    cats.forEach((c) => p.append('cat', c));

    if (ptype) p.set('type', ptype);
    if (yearFrom !== '') p.set('yearFrom', String(yearFrom));
    if (yearTo !== '') p.set('yearTo', String(yearTo));

    if (hasPdf === 'true') p.set('hasPdf', '1');
    if (hasPdf === 'false') p.set('hasPdf', '0');

    levels.forEach((lv) => p.append('level', lv));

    p.set('page', String(page));
    p.set('pageSize', String(pageSize));
    return p;
  }, [dq, dAuthor, dCats, ptype, yearFrom, yearTo, hasPdf, levels, page]);

  // ===== Fetch list =====
  const ctrlRef = useRef<AbortController | null>(null);
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
        if (!res.ok) throw new Error((json && (json.message || json.error)) || 'load failed');
        setRows(Array.isArray(json?.data) ? json.data : []);
        setTotal(Number(json?.total || 0));
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.error('load error:', e);
        setRows([]); setTotal(0);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }
    run();
    return () => ctrl.abort();
  }, [queryParams]);

  // reset page when filters change (ยกเว้น page เอง)
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, dAuthor, dCats, ptype, yearFrom, yearTo, hasPdf, levels.join(',')]);

  function clearFilters() {
    setQ('');
    setAuthor('');
    setCatsText('');
    setPtype('');
    setYearFrom('');
    setYearTo('');
    setHasPdf('any');
    setLevels([]);
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
    yearFrom !== '' ||
    yearTo !== '';

  const summaryChips = [
    dq.trim().length >= 2 ? `คำค้น: “${dq}”` : null,
    dAuthor.trim().length >= 2 ? `ผู้แต่ง: “${dAuthor}”` : null,
    dCats ? `หมวดหมู่: ${dCats}` : null,
    ptype ? `ประเภท: ${ptype}` : null,
    hasPdf === 'true' ? 'มีไฟล์ PDF' : hasPdf === 'false' ? 'ไม่มีไฟล์ PDF' : null,
    (yearFrom !== '' || yearTo !== '') ? `ช่วงปี: ${yearFrom || '…'}–${yearTo || '…'}` : null,
    levels.length ? `ระดับ: ${levels.join(', ')}` : null,
    'สถานะ: published',
  ].filter(Boolean) as string[];

  const pageStart = (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, total);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4 px-6 pb-10">
      {/* ===== แถบค้นหา (เหมือน Dashboard) ===== */}
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

          {/* ผู้แต่ง + suggest */}
          <div className="col-span-12 md:col-span-5 relative" ref={authorWrapRef}>
            <label className="text-xs text-gray-500 mb-1 block">ชื่ออาจารย์ / ผู้แต่ง</label>
            <input
              value={author}
              onChange={(e) => { setAuthor(e.target.value); setAuthorOpen(true); }}
              onFocus={() => { if (authorOpts.length) setAuthorOpen(true); }}
              placeholder="เช่น Somchai หรือ Somchai, Suda (อย่างน้อย 2 ตัวอักษร)"
              className="w-full border rounded-xl px-3 py-2"
            />
            {authorOpen && authorOpts.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white border rounded-xl shadow max-h-64 overflow-auto">
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

          {/* หมวดหมู่ + suggest */}
          <div className="col-span-12 md:col-span-5 relative" ref={catWrapRef}>
            <label className="text-xs text-gray-500 mb-1 block">หมวดหมู่ (คั่นด้วย ,)</label>
            <input
              value={catsText}
              onChange={(e) => { setCatsText(e.target.value); setCatOpen(true); }}
              onFocus={() => { if (catOpts.length) setCatOpen(true); }}
              placeholder="เช่น Data Science, Software Engineering"
              className="w-full border rounded-xl px-3 py-2"
            />
            {catOpen && catOpts.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white border rounded-xl shadow max-h-64 overflow-auto">
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
              * ระบุหลายหมวดเพื่อค้นหา “ผลงานที่มีครบทุกหมวด”
            </div>
          </div>

          <div className="col-span-6 md:col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">ปี (จาก)</label>
            <input
              type="number"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value ? Number(e.target.value) : '')}
              className="w-full border rounded-xl px-3 py-2"
              placeholder={String(thisYear - 2)}
            />
          </div>
          <div className="col-span-6 md:col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">ปี (ถึง)</label>
            <input
              type="number"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value ? Number(e.target.value) : '')}
              className="w-full border rounded-xl px-3 py-2"
              placeholder={String(thisYear)}
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

            {/* โหมดดูอย่างเดียว — ไม่มีปุ่มสร้างใหม่ */}
            <div className="hidden md:block text-xs text-gray-500 px-2">
              แสดงเฉพาะผลงานที่เผยแพร่แล้ว
            </div>
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

            {/* ไม่มี “สถานะ” ในหน้านี้ */}
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
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    ไม่พบรายการ
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const name = (r.pub_name || '').trim();
                  const venue = (r.venue_name || '').trim();
                  const displayTitle = name || venue || `#${r.pub_id}`;
                  const showVenueLine = !!venue && (!!name ? venue.toLowerCase() !== name.toLowerCase() : true);
                  const badgeClass = STATUS_STYLE['published'];
                  return (
                    <tr key={r.pub_id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{displayTitle}</div>
                        {showVenueLine && <div className="text-xs text-zinc-500">{venue}</div>}
                      </td>
                      <td className="px-3 py-3">{r.level || '-'}</td>
                      <td className="px-3 py-3">{Number.isFinite(r.year as any) ? r.year : '-'}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full ${badgeClass}`}>published</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <Link href={`/professor/publications/${r.pub_id}?from=all`} className="px-2.5 py-1.5 text-xs rounded-lg border hover:bg-zinc-50">
                            ดู
                          </Link>
                          {/* ไม่มีปุ่มแก้ไข */}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* เพจจิเนชัน */}
        <div className="flex items-center justify-between px-4 py-3 text-sm text-gray-600">
          <div>{total > 0 ? <>แสดง {pageStart}-{pageEnd} จาก {total} รายการ</> : <>ไม่มีข้อมูล</>}</div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg border disabled:opacity-50"
            >
              ก่อนหน้า
            </button>
            <div className="px-2 py-1">
              หน้า {page} / {pageCount}
            </div>
            <button
              onClick={() => setPage(page + 1)}
              disabled={pageEnd >= total}
              className="px-3 py-1 rounded-lg border disabled:opacity-50"
            >
              หน้าถัดไป
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
