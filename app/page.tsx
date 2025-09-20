'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type ResultItem = {
  pub_id: number;
  title?: string | null;        // ถ้าไม่มี title ใน DB จะ fallback เป็น venue_name
  venue_name?: string | null;
  level?: string | null;        // JOURNAL / CONF / BOOK (สมมติจาก schema)
  year?: number | null;
  has_pdf?: boolean | null;
  link_url?: string | null;
  authors: string[];            // รวมชื่อผู้เขียนจาก person
  categories: string[];         // รวม category_name
};

type FetchResponse = {
  data: ResultItem[];
  total: number;
};

const PAGE_SIZE = 10;

export default function LandingPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // ค่ากรองจาก URL (รองรับแชร์ลิงก์)
  const [q, setQ] = useState(sp.get('q') || '');
  const [author, setAuthor] = useState(sp.get('author') || '');
  const [category, setCategory] = useState(sp.get('category') || ''); // ชื่อหมวด
  const [typeFilter, setTypeFilter] = useState(sp.get('type') || ''); // JOURNAL/CONF/BOOK
  const [yearFrom, setYearFrom] = useState(sp.get('y1') || '');
  const [yearTo, setYearTo] = useState(sp.get('y2') || '');
  const [hasPdf, setHasPdf] = useState(sp.get('pdf') === '1');

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(sp.get('p') || 1));

  // โหลด categories มาใส่ dropdown (ถ้าอยากเป็น list – ตอนนี้ดึงแบบขี้เกียจจาก API เดียวกันได้ แต่แยก endpoint จะดีสุด)
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  // เรียกค้นหา
  async function search() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (author) params.set('author', author);
      if (category) params.set('category', category);
      if (typeFilter) params.set('type', typeFilter);
      if (yearFrom) params.set('yearFrom', yearFrom);
      if (yearTo) params.set('yearTo', yearTo);
      if (hasPdf) params.set('hasPdf', '1');
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));

      // sync URL
      router.replace('/?' + params.toString());

      const res = await fetch('/api/publications/search?' + params.toString(), { cache: 'no-store' });
      const json: FetchResponse & { categories?: string[] } = await res.json();
      if (!res.ok) throw new Error((json as any).message || 'search failed');
      setItems(json.data || []);
      setTotal(json.total || 0);
      if (json.categories) setCategoryOptions(json.categories);
    } catch (e: any) {
      console.error('search error:', e?.message || e);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    search();
  }

  const showingFrom = (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, total);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="flex items-center justify-end px-6 py-3 text-sm text-gray-600">
        <a href="/login" className="hover:underline">เข้าสู่ระบบ</a>
      </div>

      <main className="px-6 pb-10 max-w-6xl mx-auto">
        <h1 className="text-lg font-semibold mb-4">ค้นหาผลงานตีพิมพ์</h1>

        {/* แถบค้นหาเร็ว */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-4 mb-4">
          <div className="flex gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="พิมพ์คำค้นหา: ชื่อเรื่อง, คำสำคัญ, ผู้แต่ง..."
              className="flex-1 border rounded-xl px-4 py-2"
            />
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              ค้นหา
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-2">ป.ล. บุคคลทั่วไปไม่ต้องเข้าสู่ระบบก็ค้นหาได้</div>
        </form>

        {/* ตัวกรองเพิ่มเติม */}
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-12 md:col-span-3">
              <div className="text-xs text-gray-500 mb-1">ผู้เขียน</div>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="กรองชื่อผู้เขียน..."
                className="w-full border rounded-xl px-3 py-2"
              />
            </div>
            <div className="col-span-12 md:col-span-3">
              <div className="text-xs text-gray-500 mb-1">หมวดหมู่</div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border rounded-xl px-3 py-2"
              >
                <option value="">-- ทั้งหมด --</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="col-span-12 md:col-span-3">
              <div className="text-xs text-gray-500 mb-1">ประเภท</div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full border rounded-xl px-3 py-2"
              >
                <option value="">-- ทั้งหมด --</option>
                <option value="JOURNAL">JOURNAL</option>
                <option value="CONF">CONF</option>
                <option value="BOOK">BOOK</option>
              </select>
            </div>
            <div className="col-span-6 md:col-span-1">
              <div className="text-xs text-gray-500 mb-1">ช่วงปี</div>
              <input
                type="number"
                placeholder="จาก"
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                className="w-full border rounded-xl px-3 py-2"
              />
            </div>
            <div className="col-span-6 md:col-span-1">
              <div className="text-xs text-gray-500 mb-1">&nbsp;</div>
              <input
                type="number"
                placeholder="ถึง"
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value)}
                className="w-full border rounded-xl px-3 py-2"
              />
            </div>
            <div className="col-span-12 md:col-span-1">
              <div className="text-xs text-gray-500 mb-1">ไฟล์ PDF</div>
              <button
                type="button"
                onClick={() => setHasPdf((v) => !v)}
                className={`w-full px-3 py-2 rounded-xl border ${hasPdf ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-700'}`}
              >
                {hasPdf ? 'มี' : 'ทั้งหมด'}
              </button>
            </div>
            <div className="col-span-12 md:col-span-1 flex md:justify-end">
              <button onClick={() => { setAuthor(''); setCategory(''); setTypeFilter(''); setYearFrom(''); setYearTo(''); setHasPdf(false); setPage(1); search(); }} className="px-3 py-2 rounded-xl bg-gray-100">
                ล้าง
              </button>
            </div>
          </div>
        </div>

        {/* ผลการค้นหา */}
        <div className="bg-white rounded-xl shadow p-2">
          {loading ? (
            <div className="p-6 text-center text-gray-500">กำลังโหลด...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-gray-500">ไม่พบผลลัพธ์</div>
          ) : (
            <div className="divide-y">
              {items.map((it) => (
                <div key={it.pub_id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium">
                      {it.title || it.venue_name || '(ไม่มีชื่อเรื่อง)'}
                    </div>
                    <div className="text-sm text-gray-600">
                      {it.authors.join(', ') || '—'} — {it.year ?? '—'} • {it.level ?? '—'}
                      {it.categories.length ? (
                        <>
                          {' '} • {it.categories.join(' • ')}
                        </>
                      ) : null}
                      {it.has_pdf ? ' • PDF' : ''}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {it.link_url ? (
                      <a
                        href={it.link_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                      >
                        ดูรายละเอียด
                      </a>
                    ) : (
                      <a
                        href={`/publication/${it.pub_id}`}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                      >
                        ดูรายละเอียด
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* footer + pagination */}
          <div className="flex items-center justify-between px-3 py-3 text-sm text-gray-600">
            <div>แสดง {total ? `${showingFrom}-${showingTo}` : 0} จาก {total} รายการ</div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 rounded-lg border" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>ก่อนหน้า</button>
              <div className="px-2">หน้า {page}/{totalPages}</div>
              <button className="px-3 py-1 rounded-lg border" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>หน้าถัดไป</button>
            </div>
          </div>
        </div>

        <div className="text-right mt-2 text-xs text-gray-500">
          หน้าถัดไป ►
        </div>
      </main>
    </div>
  );
}
