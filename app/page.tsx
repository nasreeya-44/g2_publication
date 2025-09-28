'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/* ================= Types ================= */
type Row = {
  pub_id: number;
  pub_name: string | null;     // ชื่อเรื่องหลัก
  year: number | null;
  type: string | null;         // JOURNAL / CONFERENCE / BOOK / OTHER
  level: string | null;        // NATIONAL / INTERNATIONAL
  has_pdf: boolean;
  status: string | null;
  link_url: string | null;
  venue_name: string | null;
  updated_at: string | null;
  authors: string[];
  categories: string[];
  has_student?: boolean | null; // (ถ้า API คืนมา)
};

type SearchResponse = {
  data: Row[];
  total: number;
  page: number;
  pageSize: number;
  facets?: {
    categories?: Array<{ name: string; count: number }>;
  };
  message?: string;
};

/* ================= Constants ================= */
const SCOPE_OPTIONS = [
  { label: 'ทั้งหมด',   value: 'ALL' },
  { label: 'ชื่อเรื่อง', value: 'TITLE' },
  { label: 'ผู้วิจัย',   value: 'AUTHOR' },
  { label: 'คำสำคัญ',   value: 'KEYWORD' },
] as const;

const TYPE_OPTIONS = [
  { label: 'ทั้งหมด', value: 'ALL' },
  { label: 'JOURNAL', value: 'JOURNAL' },
  { label: 'CONFERENCE', value: 'CONFERENCE' },
  { label: 'BOOK', value: 'BOOK' },
  { label: 'OTHER', value: 'OTHER' },
] as const;

/* ================= Page ================= */
export default function SearchPage() {
  const router = useRouter();

  // --------- filters (บนแถบค้นหา) ----------
  const [scope, setScope] = useState<(typeof SCOPE_OPTIONS)[number]['value']>('ALL');
  const [q, setQ] = useState('');
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]['value']>('ALL');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [hasPdf, setHasPdf] = useState(false);
  const [hasStudent, setHasStudent] = useState(false);

  // --------- Sidebar (หมวดหมู่, multi-select) ----------
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // --------- data ----------
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  // คำนวณ facets หมวดหมู่จากผลลัพธ์ปัจจุบัน (ถ้า API ไม่มี)
  const categoryFacets = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      for (const c of r.categories || []) {
        map.set(c, (map.get(c) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  // debounce คำค้นเร็ว
  const typingTimer = useRef<NodeJS.Timeout | null>(null);

  async function runSearch(goPage = 1) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (scope && scope !== 'ALL') params.set('scope', scope);
      if (q.trim()) params.set('q', q.trim());
      if (type !== 'ALL') params.set('type', type);
      if (yearFrom.trim()) params.set('year_from', yearFrom.trim());
      if (yearTo.trim()) params.set('year_to', yearTo.trim());
      if (hasPdf) params.set('has_pdf', '1');
      if (hasStudent) params.set('has_student', '1');
      if (selectedCategories.length) params.set('categories', selectedCategories.join(','));

      params.set('page', String(goPage));
      params.set('pageSize', String(pageSize));

      const res = await fetch(`/api/publications/search?${params.toString()}`, { cache: 'no-store' });
      const json = (await res.json()) as SearchResponse;
      if (!res.ok) throw new Error(json?.message || `Search failed (${res.status})`);

      setRows(json.data || []);
      setTotal(json.total || 0);
      setPage(json.page || goPage);
    } catch (e: any) {
      setRows([]);
      setTotal(0);
      setError(e?.message || 'โหลดข้อมูลล้มเหลว');
    } finally {
      setLoading(false);
    }
  }

  // โหลดครั้งแรก
  useEffect(() => {
    runSearch(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ค้นหาอัตโนมัติเมื่อเลือกหมวดหมู่ / toggle / type
  useEffect(() => {
    runSearch(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategories, hasPdf, hasStudent, type]);

  // debounce เมื่อพิมพ์ค้นหา / เปลี่ยนช่วงปี / ขอบเขต
  useEffect(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => runSearch(1), 450);
    return () => typingTimer.current && clearTimeout(typingTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, scope, yearFrom, yearTo]);

  // ----- helpers -----
  function displayTitle(r: Row) {
    return r.pub_name || r.venue_name || r.link_url || `Publication #${r.pub_id}`;
  }

  function clearAll() {
    setScope('ALL');
    setQ('');
    setType('ALL');
    setYearFrom('');
    setYearTo('');
    setHasPdf(false);
    setHasStudent(false);
    setSelectedCategories([]);
    setPage(1);
    setTimeout(() => runSearch(1), 0);
  }

  function clearCategories() {
    setSelectedCategories([]);
    setTimeout(() => runSearch(1), 0);
  }

  function goDetail(id: number) {
    router.push(`/publications/${id}`);
  }

  function onRowKey(e: React.KeyboardEvent<HTMLDivElement>, id: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goDetail(id);
    }
  }

  function fmtDate(iso?: string | null) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* ======= Branded Header ======= */}
      <header className="bg-gradient-to-br from-slate-900 via-blue-900 to-blue-800">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-7">
          {/* Top brand + login */}
          <div className="flex items-center justify-between text-white/90">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-white/10 ring-1 ring-white/15 grid place-items-center text-sm font-bold">P</div>
              <div>
                <div className="text-[15px] font-semibold tracking-wide">ฐานข้อมูลผลงานตีพิมพ์</div>
                <div className="text-[12px] text-white/75">COMSCI PSU • Public Search</div>
              </div>
            </div>
            <Link
              href="/login"
              className="text-sm rounded-xl px-3 py-1.5 bg-white/10 hover:bg-white/15 ring-1 ring-white/20"
            >
              เข้าสู่ระบบ
            </Link>
          </div>

          {/* Search card */}
          <div className="mt-5 bg-white/95 backdrop-blur rounded-2xl shadow-lg ring-1 ring-black/5 p-4 md:p-5">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Scope select */}
              <div className="w-full md:w-56">
                <label className="text-xs text-slate-600 mb-1 block">ค้นหาจาก</label>
                <div className="relative">
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as any)}
                    className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 pr-9 text-slate-800"
                    aria-label="ประเภทการค้นหา"
                  >
                    {SCOPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 text-gray-400" />
                </div>
              </div>

              {/* Keyword */}
              <div className="flex-1">
                <label className="text-xs text-slate-600 mb-1 block">คำค้น</label>
                <div className="relative">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="ค้นหาทั้งระบบ เช่น ชื่อเรื่อง, ผู้วิจัย, คำสำคัญ..."
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 pl-10 text-slate-800"
                    aria-label="คำค้น"
                  />
                  <SearchIcon className="absolute left-3 top-2.5 text-gray-400" />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 md:ml-auto items-end">
                <button
                  onClick={() => runSearch(1)}
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 shadow-sm"
                  aria-label="ค้นหา"
                >
                  <SearchIcon className="mr-2" /> ค้นหา
                </button>
                <button
                  onClick={clearAll}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 shadow-sm"
                  aria-label="ล้างตัวกรองทั้งหมด"
                >
                  <RefreshIcon className="mr-2" /> รีเซ็ต
                </button>
              </div>
            </div>

            {/* Secondary filters */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-3">
                <label className="text-xs text-slate-600 mb-1 block">ประเภท</label>
                <div className="relative">
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 pr-9 text-slate-800"
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 text-gray-400" />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs text-slate-600 mb-1 block">ปีเริ่มต้น</label>
                <input
                  inputMode="numeric"
                  placeholder="ค.ศ."
                  value={yearFrom}
                  onChange={(e) => setYearFrom(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-slate-800"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-slate-600 mb-1 block">ปีสิ้นสุด</label>
                <input
                  inputMode="numeric"
                  placeholder="ค.ศ."
                  value={yearTo}
                  onChange={(e) => setYearTo(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-slate-800"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs text-slate-600 mb-1 block">ไฟล์ PDF</label>
                <label className="inline-flex items-center gap-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasPdf}
                    onChange={(e) => setHasPdf(e.target.checked)}
                  />
                  <span className="inline-flex items-center gap-2 text-slate-800">
                    <PdfIcon className="text-rose-500" /> มีไฟล์ PDF
                  </span>
                </label>
              </div>
              <div className="md:col-span-3">
                <label className="text-xs text-slate-600 mb-1 block">นักศึกษาร่วม</label>
                <label className="inline-flex items-center gap-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasStudent}
                    onChange={(e) => setHasStudent(e.target.checked)}
                  />
                  <span className="inline-flex items-center gap-2 text-slate-800">
                    <StudentIcon className="text-amber-600" /> มีนักศึกษาร่วม
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ======= Content: Sidebar (หมวดหมู่) + Results ======= */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="md:col-span-3">
          <div className="md:sticky md:top-4 bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <div className="text-sm font-semibold text-slate-800">หมวดหมู่</div>
            </div>

            {categoryFacets.length === 0 ? (
              <div className="p-5 text-sm text-gray-600">— ไม่มีหมวดหมู่ในผลลัพธ์ชุดนี้ —</div>
            ) : (
              <ul className="max-h-[56vh] overflow-auto p-2">
                {categoryFacets.map((c) => (
                  <li key={c.name} className="px-2">
                    <label className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(c.name)}
                          onChange={(e) => {
                            setSelectedCategories((prev) =>
                              e.target.checked ? [...prev, c.name] : prev.filter((x) => x !== c.name)
                            );
                          }}
                        />
                        <span className="truncate text-sm text-slate-800">{c.name}</span>
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 ring-1 ring-gray-200">
                        {c.count}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <div className="p-3 border-t bg-white flex gap-2">
              <button
                onClick={clearCategories}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                ล้างหมวดหมู่
              </button>
              <button
                onClick={() => runSearch(1)}
                className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              >
                ค้นหา
              </button>
            </div>
          </div>
        </aside>

        {/* Results */}
        <section className="md:col-span-9">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className="px-4 md:px-5 py-3 border-b bg-gray-50">
              <div className="text-sm text-gray-700">
                แสดง {rows.length > 0 ? (page - 1) * pageSize + 1 : 0} – {Math.min(page * pageSize, total)} จาก {total} รายการ
                {error && <span className="text-rose-600 ml-2">({error})</span>}
              </div>
            </div>

            {loading ? (
              <div className="divide-y">
                {Array.from({ length: 5 }).map((_, i) => <ResultSkeleton key={i} />)}
              </div>
            ) : rows.length === 0 ? (
              <EmptyState title="ไม่พบรายการ" subtitle="ลองปรับตัวกรอง หรือใช้คำค้นที่กว้างขึ้น" />
            ) : (
              <div className="divide-y">
                {rows.map((r) => (
                  <div
                    key={r.pub_id}
                    className="p-5 group cursor-pointer hover:bg-slate-50/60 transition"
                    role="button"
                    tabIndex={0}
                    onClick={() => goDetail(r.pub_id)}
                    onKeyDown={(e) => onRowKey(e, r.pub_id)}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="min-w-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); goDetail(r.pub_id); }}
                          className="block w-full text-left font-semibold text-slate-900 hover:text-blue-700 hover:underline truncate"
                          title={displayTitle(r)}
                        >
                          {displayTitle(r)}
                        </button>

                        <div className="mt-1 text-[13px] text-gray-600 truncate">
                          {r.authors.join(', ') || '—'} — {r.year ?? '—'} • {r.type || '—'} • {r.level || '—'}
                          {r.has_pdf ? <Badge className="ml-2" tone="emerald">PDF</Badge> : null}
                          {r.has_student ? <Badge className="ml-1" tone="amber">Student</Badge> : null}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {r.categories.slice(0, 6).map((c, i) => (
                            <Chip key={i}>{c}</Chip>
                          ))}
                          {r.categories.length > 6 && <Chip tone="slate">+{r.categories.length - 6}</Chip>}
                        </div>

                        <div className="mt-2 text-[12px] text-gray-400">
                          อัปเดตล่าสุด: {fmtDate(r.updated_at)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={`/publications/${r.pub_id}`}
                          prefetch={false}
                          className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ดูรายละเอียด
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            <div className="px-4 md:px-5 py-3 border-t flex items-center justify-between text-sm text-gray-700 bg-white">
              <div>หน้า {page} / {totalPages}</div>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => { const next = Math.max(1, page - 1); setPage(next); runSearch(next); }}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                >
                  ก่อนหน้า
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => { const next = Math.min(totalPages, page + 1); setPage(next); runSearch(next); }}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                >
                  ถัดไป
                </button>
              </div>
            </div>
          </div>

          <div className="text-right text-xs text-gray-400 mt-6">© COMSCI PSU — Public Search</div>
        </section>
      </main>
    </div>
  );
}

/* ================= Small UI ================= */
function Badge({
  children,
  tone = 'slate',
  className = '',
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'emerald' | 'sky' | 'amber';
  className?: string;
}) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    sky: 'bg-sky-50 text-sky-700 ring-sky-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full ring-1 ${map[tone]} ${className}`}>
      {children}
    </span>
  );
}

function Chip({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'blue' | 'indigo' | 'sky';
}) {
  const map: Record<string, string> = {
    slate: 'bg-gray-50 text-gray-700 ring-gray-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  };
  return (
    <span className={`text-[11px] px-2 py-1 rounded-full ring-1 ${map[tone]}`}>
      {children}
    </span>
  );
}

/* ===== SVG Icons (no external deps) ===== */
function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function RefreshIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 6V3L8 7l4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z" />
    </svg>
  );
}
function PdfIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M13 2v6h6" />
    </svg>
  );
}
function StudentIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3L2 8l10 5 8-4v6h2V8L12 3z" />
      <path d="M6 12v5l6 3 6-3v-5l-6 3-6-3z" />
    </svg>
  );
}
function ChevronDown({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 10l5 5 5-5H7z" />
    </svg>
  );
}

function ResultSkeleton() {
  return (
    <div className="p-6 animate-pulse">
      <div className="h-3.5 bg-gray-100 rounded w-2/5" />
      <div className="mt-2 h-3 bg-gray-100 rounded w-3/5" />
      <div className="mt-3 flex gap-2">
        <div className="h-5 w-16 bg-gray-100 rounded-full" />
        <div className="h-5 w-14 bg-gray-100 rounded-full" />
        <div className="h-5 w-20 bg-gray-100 rounded-full" />
      </div>
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 grid place-items-center text-gray-400">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20 17H4v2h16v-2zM4 5h7v6H4V5zm9 0h7v6h-7V5zM4 13h7v2H4v-2zm9 0h7v2h-7v-2z" />
        </svg>
      </div>
      <h3 className="mt-3 text-slate-800 font-medium">{title}</h3>
      {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
    </div>
  );
}