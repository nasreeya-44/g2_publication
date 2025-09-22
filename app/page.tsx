'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Row = {
  pub_id: number;
  year: number | null;
  type: string | null;         // จาก venue.type (JOURNAL/CONFERENCE/BOOK/OTHER)
  level: string | null;        // NATIONAL/INTERNATIONAL
  has_pdf: boolean;
  status: string | null;
  link_url: string | null;
  venue_name: string | null;
  updated_at: string | null;
  authors: string[];
  categories: string[];
};

type SearchResponse = {
  data: Row[];
  total: number;
  page: number;
  pageSize: number;
  message?: string;
};

const TYPE_OPTIONS = [
  { label: 'ทั้งหมด', value: 'ALL' },
  { label: 'JOURNAL', value: 'JOURNAL' },
  { label: 'CONFERENCE', value: 'CONFERENCE' },
  { label: 'BOOK', value: 'BOOK' },
  { label: 'OTHER', value: 'OTHER' },
] as const;

const PDF_OPTIONS = [
  { label: 'ทั้งหมด', value: 'ALL' },
  { label: 'มี', value: '1' },
  { label: 'ไม่มี', value: '0' },
] as const;

export default function SearchPage() {
  // ---------- filters ----------
  const [q, setQ] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]['value']>('ALL');
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [hasPdf, setHasPdf] = useState<(typeof PDF_OPTIONS)[number]['value']>('ALL');

  // ---------- data ----------
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  async function runSearch(goPage = 1) {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (author.trim()) params.set('author', author.trim());
      if (category.trim()) params.set('category', category.trim());
      // type → ถ้าไม่ใช่ ALL จึงส่ง
      if (type && type !== 'ALL') params.set('type', type);
      if (yearFrom.trim()) params.set('year_from', yearFrom.trim());
      if (yearTo.trim()) params.set('year_to', yearTo.trim());
      if (hasPdf !== 'ALL') params.set('has_pdf', hasPdf); // '1' หรือ '0'
      params.set('page', String(goPage));
      params.set('pageSize', String(pageSize));

      const res = await fetch(`/api/publications/search?${params.toString()}`, { cache: 'no-store' });
      const json = (await res.json()) as SearchResponse;

      if (!res.ok) {
        throw new Error(json?.message || `Search failed (${res.status})`);
      }

      setRows(json.data || []);
      setTotal(json.total || 0);
      setPage(json.page || goPage);
    } catch (e: any) {
      setError(e?.message || 'โหลดข้อมูลล้มเหลว');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  // โหลดรอบแรก
  useEffect(() => {
    runSearch(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- UI helpers -----
  function displayTitle(r: Row) {
    return r.venue_name || r.link_url || `Publication #${r.pub_id}`;
  }

  function clearAll() {
    setQ('');
    setAuthor('');
    setCategory('');
    setType('ALL');
    setYearFrom('');
    setYearTo('');
    setHasPdf('ALL');
    setPage(1);
    // โหลดใหม่
    setTimeout(() => runSearch(1), 0);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 flex items-center justify-between">
        <h1 className="text-sm text-gray-500">ค้นหาผลงานตีพิมพ์</h1>
        <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">เข้าสู่ระบบ</Link>
      </div>

      {/* Search panel */}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 md:p-5">
          {/* Quick search */}
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500">ค้นหาแบบเร็ว</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="เช่น ชื่อผลงาน, ลิงก์, ชื่อวารสาร, ผู้เขียน…"
                onKeyDown={(e) => e.key === 'Enter' && runSearch(1)}
                className="w-full rounded-xl border px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-[11px] text-gray-400 mt-1">ปล. บางกรณีไม่มีต้องลองคำอื่นเพิ่มเติม</div>
            </div>
            <div className="flex-none md:self-end">
              <button
                onClick={() => runSearch(1)}
                className="w-full md:w-auto px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              >
                ค้นหา
              </button>
            </div>
          </div>

          {/* Advanced filters */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-3">
              <label className="text-xs text-gray-500">ผู้เขียน</label>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch(1)}
                placeholder="กรอกชื่อผู้เขียน…"
                className="w-full rounded-xl border px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-gray-500">หมวดหมู่</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch(1)}
                placeholder="AI / Data Science / …"
                className="w-full rounded-xl border px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-gray-500">ประเภท (จาก Venue)</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full rounded-xl border px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="text-xs text-gray-500">ช่วงปี (จาก)</label>
              <input
                inputMode="numeric"
                placeholder="2019"
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-xs text-gray-500">ถึง</label>
              <input
                inputMode="numeric"
                placeholder="2025"
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-1">
              <label className="text-xs text-gray-500">ไฟล์ PDF</label>
              <select
                value={hasPdf}
                onChange={(e) => setHasPdf(e.target.value as any)}
                className="w-full rounded-xl border px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
              >
                {PDF_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => runSearch(1)}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              ค้นหาตามตัวกรอง
            </button>
            <button
              onClick={clearAll}
              className="px-4 py-2 rounded-xl border hover:bg-gray-50"
            >
              ล้างตัวกรอง
            </button>
            {error && <div className="text-sm text-rose-600 ml-auto">{error}</div>}
          </div>
        </div>

        {/* Results */}
        <div className="mt-5 bg-white rounded-2xl shadow-sm ring-1 ring-gray-100">
          <div className="px-4 md:px-5 py-3 border-b">
            <div className="text-sm text-gray-600">
              แสดง {rows.length > 0 ? (page - 1) * pageSize + 1 : 0} – {Math.min(page * pageSize, total)} จาก {total} รายการ
            </div>
          </div>

          <div className="divide-y">
            {loading ? (
              <div className="p-6 text-gray-500">กำลังโหลด…</div>
            ) : rows.length === 0 ? (
              <div className="p-6 text-gray-500">ไม่พบบันทึก</div>
            ) : (
              rows.map((r) => (
                <div key={r.pub_id} className="p-4 md:p-5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{displayTitle(r)}</div>
                      <div className="mt-1 text-[13px] text-gray-600">
                        {r.authors.join(', ') || '—'} — {r.year ?? '—'} • {r.type || '—'} • {r.level || '—'}
                      </div>
                      {r.categories.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {r.categories.map((c, i) => (
                            <span key={i} className="text-[11px] px-2 py-1 rounded-full border bg-gray-50">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ใช้ Link ของ Next.js → ไปหน้า /publications/[id] แน่นอน */}
                    <Link
                      href={`/publications/${r.pub_id}`}
                      className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                    >
                      ดูรายละเอียด
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="px-4 md:px-5 py-3 border-t flex items-center justify-between text-sm text-gray-600">
            <div>หน้า {page} / {totalPages}</div>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => runSearch(page - 1)}
                className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-40"
              >
                ก่อนหน้า
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => runSearch(page + 1)}
                className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-40"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </div>

        <div className="text-right text-xs text-gray-400 mt-3">© COMSCI PSU — Public Search</div>
      </div>
    </div>
  );
}