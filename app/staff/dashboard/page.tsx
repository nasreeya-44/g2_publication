'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// --- mock side nav (เล็ก ๆ ในไฟล์นี้เลย เพื่อตัดปัญหา import) ---
function SideNavMockInline() {
  const items = [
    { href: '/staff/dashboard', label: 'หน้าหลัก', icon: '🏠' },
    { href: '/staff/publications/new', label: 'เพิ่มผลงาน', icon: '➕' },
    { href: '/staff/search', label: 'ค้นหา', icon: '🔎' },
    { href: '/staff/profile', label: 'โปรไฟล์', icon: '👤' },
    { href: '/staff/filters', label: 'ตัวกรอง', icon: '🧰' },
    { href: '/staff/history', label: 'ประวัติ', icon: '⏱️' },
    { href: '/staff/library', label: 'คลัง', icon: '📚' },
    { href: '/staff/files', label: 'ไฟล์', icon: '🗂️' },
  ];
  return (
    <aside className="fixed left-4 top-24 z-10">
      <div className="flex flex-col gap-3">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            title={it.label}
            className="w-10 h-10 rounded-full border flex items-center justify-center bg-white shadow-sm hover:bg-slate-50"
          >
            <span className="text-[18px]" aria-hidden>{it.icon}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}

// --- types ---
type Row = {
  pub_id: number;
  title?: string | null;
  type?: string | null;   // JOURNAL/CONFERENCE/BOOK
  rank?: string | null;   // NATIONAL/INTERNATIONAL
  year?: number | null;
  status?: string | null; // draft/under_review/published/archived
  venue_name?: string | null;
};

type Counters = {
  total: number;
  draft: number;
  under_review: number;
  published: number;
  archived: number;
};

const PAGE_SIZE = 20;

function StatusPill({ value }: { value?: string | null }) {
  const v = (value || '').toLowerCase();
  const base = 'text-xs px-3 py-1 rounded-full inline-block select-none';
  if (v === 'published') return <span className={`${base} bg-green-100 text-green-700`}>เผยแพร่แล้ว</span>;
  if (v === 'under_review') return <span className={`${base} bg-amber-100 text-amber-700`}>อยู่ระหว่างตรวจสอบ</span>;
  if (v === 'archived') return <span className={`${base} bg-gray-200 text-gray-700`}>เก็บถาวร</span>;
  return <span className={`${base} bg-rose-100 text-rose-700`}>แบบร่าง</span>;
}

export default function StaffDashboardPage() {
  // filters
  const [yearFrom, setYearFrom] = useState('2019');
  const [yearTo, setYearTo] = useState('2025');
  const [type, setType] = useState('JOURNAL / CONFERENCE'); // รวมสองค่า ตามภาพ
  const [rank, setRank] = useState('INTERNATIONAL');
  const [q, setQ] = useState('');

  // data
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [counters, setCounters] = useState<Counters | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fromIdx = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const toIdx = Math.min(page * PAGE_SIZE, total);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q) p.set('q', q);
      if (type === 'JOURNAL' || type === 'CONFERENCE' || type === 'BOOK') p.set('type', type);
      if (rank) p.set('rank', rank);
      if (yearFrom) p.set('yearFrom', yearFrom);
      if (yearTo) p.set('yearTo', yearTo);
      p.set('page', String(page));
      p.set('pageSize', String(PAGE_SIZE));
      const res = await fetch('/api/staff/publications?' + p.toString(), { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'fetch failed');
      setRows(json.data || []);
      setTotal(json.total || 0);
      setCounters(json.counters || null);
    } catch (e: any) {
      console.error('load staff publications:', e?.message || e);
      setRows([]); setTotal(0); setCounters(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-line */ }, [page]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <SideNavMockInline />
      <div className="flex items-center justify-end px-6 py-3 text-sm text-gray-600">
        ผู้ใช้: <span className="font-semibold ml-1">somchai</span> (<span className="uppercase">STAFF</span>)
      </div>

      <main className="px-6 pb-10 max-w-6xl mx-auto">
        <h1 className="text-sm font-semibold mb-4">รายการผลงานตีพิมพ์</h1>

        {/* Filters */}
        <form onSubmit={submit} className="bg-white rounded-xl shadow p-4 mb-4">
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-12 sm:col-span-2">
              <div className="text-xs text-gray-500 mb-1">ช่วงปี</div>
              <input value={yearFrom} onChange={e=>setYearFrom(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
            </div>
            <div className="col-span-12 sm:col-span-2">
              <div className="text-xs text-gray-500 mb-1 invisible sm:visible">.</div>
              <input value={yearTo} onChange={e=>setYearTo(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
            </div>
            <div className="col-span-12 sm:col-span-3">
              <div className="text-xs text-gray-500 mb-1">ประเภท</div>
              <select value={type} onChange={e=>setType(e.target.value)} className="w-full border rounded-xl px-3 py-2">
                <option>JOURNAL / CONFERENCE</option>
                <option>JOURNAL</option>
                <option>CONFERENCE</option>
                <option>BOOK</option>
              </select>
            </div>
            <div className="col-span-12 sm:col-span-3">
              <div className="text-xs text-gray-500 mb-1">ระดับ</div>
              <select value={rank} onChange={e=>setRank(e.target.value)} className="w-full border rounded-xl px-3 py-2">
                <option>INTERNATIONAL</option>
                <option>NATIONAL</option>
              </select>
            </div>
            <div className="col-span-12 sm:col-span-2">
              <div className="text-xs text-gray-500 mb-1">คำค้นหา</div>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="keyword, author..." className="w-full border rounded-xl px-3 py-2" />
            </div>
            <div className="col-span-12 sm:col-span-2 sm:justify-end flex">
              <button type="submit" className="w-full sm:w-auto px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700">ค้นหา</button>
            </div>
          </div>
        </form>

        {/* Counters */}
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="px-3 py-2 rounded-xl bg-gray-100">ทั้งหมด : {counters?.total ?? 0}</span>
            <span className="px-3 py-2 rounded-xl bg-rose-100 text-rose-700">แบบร่าง : {counters?.draft ?? 0}</span>
            <span className="px-3 py-2 rounded-xl bg-amber-100 text-amber-700">อยู่ระหว่างตรวจสอบ : {counters?.under_review ?? 0}</span>
            <span className="px-3 py-2 rounded-xl bg-green-100 text-green-700">เผยแพร่แล้ว : {counters?.published ?? 0}</span>
            <span className="px-3 py-2 rounded-xl bg-gray-200 text-gray-700">เก็บถาวร : {counters?.archived ?? 0}</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow">
          <div className="px-4 py-2 text-sm text-gray-500 grid grid-cols-12">
            <div className="col-span-6">ชื่อ</div>
            <div className="col-span-2">ประเภท</div>
            <div className="col-span-1">ระดับ</div>
            <div className="col-span-1">ปี</div>
            <div className="col-span-1">สถานะ</div>
            <div className="col-span-1 text-right">จัดการ</div>
          </div>

          {loading ? (
            <div className="p-6 text-center text-gray-500">กำลังโหลด...</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-gray-500">ไม่พบผลลัพธ์</div>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.pub_id} className="px-4 py-3 grid grid-cols-12 items-center">
                  <div className="col-span-6">
                    <div className="font-medium">{r.title || r.venue_name || `(รายการ #${r.pub_id})`}</div>
                    <div className="text-xs text-gray-500">{r.venue_name ?? ''}</div>
                  </div>
                  <div className="col-span-2 text-sm">{r.type ?? '-'}</div>
                  <div className="col-span-1 text-sm">{r.rank ?? '-'}</div>
                  <div className="col-span-1 text-sm">{r.year ?? '-'}</div>
                  <div className="col-span-1"><StatusPill value={r.status} /></div>
                  <div className="col-span-1 flex justify-end gap-2">
                    <Link href={`/staff/publications/${r.pub_id}/edit`} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm">แก้ไข</Link>
                    <Link href={`/staff/publications/${r.pub_id}`} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm">ดู</Link>

                  </div>
                </div>
              ))}

              <div className="px-4 py-3 flex items-center justify-between text-sm text-gray-600">
                <div>แสดง {total ? `${fromIdx}-${toIdx}` : 0} จาก {total} รายการ</div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 rounded-lg border" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>ก่อนหน้า</button>
                  <div>หน้า {page}/{totalPages}</div>
                  <button className="px-3 py-1 rounded-lg border" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>หน้าถัดไป</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-right mt-2 text-xs text-gray-500">หน้าถัดไป ►</div>
      </main>
    </div>
  );
}
