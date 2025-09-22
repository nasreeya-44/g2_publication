// app/professor/dashboard/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Row = {
  pub_id: number;
  title: string | null;
  venue_name: string | null;
  level: string | null;   // NATIONAL/INTERNATIONAL
  year: number | null;
  status: string | null;  // draft/under_review/published/archived
};

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-700',
  under_review: 'bg-amber-100 text-amber-700',
  published: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-zinc-100 text-zinc-500',
};

export default function ProfessorDashboard() {
  // search / filters
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>(''); // UI label -> server map
  const [level, setLevel] = useState<string>('');   // JOURNAL / CONFERENCE / BOOK (text ที่คุณใช้)
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [hasPdf, setHasPdf] = useState<'all' | '1'>('all');
  const [onlyMine, setOnlyMine] = useState(true);
  const [withStudents, setWithStudents] = useState(false);

  // data
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      if (level) params.set('level', level);
      if (hasPdf === '1') params.set('hasPdf', '1');
      if (onlyMine) params.set('mine', '1');
      if (withStudents) params.set('withStudents', '1');
      if (yearFrom) params.set('yearFrom', yearFrom);
      if (yearTo) params.set('yearTo', yearTo);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const res = await fetch(`/api/professor/publications?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'load failed');

      setRows(json.data || []);
      setTotal(json.total || 0);
    } catch (e) {
      console.error('load error:', e);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function doSearch() {
    setPage(1);
    fetchData();
  }

  function clearFilters() {
    setQ('');
    setStatus('');
    setLevel('');
    setYearFrom('');
    setYearTo('');
    setHasPdf('all');
    setOnlyMine(true);
    setWithStudents(false);
    setPage(1);
    fetchData();
  }

  const pageStart = (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      {/* แถบค้นหา (ไม่มี title/ผู้ใช้ซ้ำแล้ว) */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="พิมพ์คำค้นหา: ชื่อเรื่อง, DOI, ผู้เขียน..."
            className="flex-1 border rounded-xl px-4 py-2"
          />
          <div className="flex gap-2">
            <button
              onClick={doSearch}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              ค้นหา
            </button>
            <Link
              href="/professor/publications/new"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            >
              + สร้างผลงานใหม่
            </Link>
          </div>
        </div>

        {/* ฟิลเตอร์ */}
        <div className="mt-4 grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-6 flex gap-2">
            <button
              onClick={() => setOnlyMine((v) => !v)}
              className={`px-3 py-2 rounded-xl text-sm border ${onlyMine ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-700'}`}
              title="เฉพาะผลงานของฉัน"
            >
              เฉพาะงานของฉัน
            </button>
            <button
              onClick={() => setWithStudents((v) => !v)}
              className={`px-3 py-2 rounded-xl text-sm border ${withStudents ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-700'}`}
              title="มีนักศึกษาเป็นผู้ร่วม"
            >
              มีนักศึกษาเป็นผู้ร่วม
            </button>
          </div>

          <div className="col-span-12 md:col-span-3">
            <div className="text-xs text-gray-500 mb-1">สถานะ</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
            >
              <option value="">DRAFT / UNDER_REVIEW / PUBLISHED / ARCHIVED</option>
              <option value="draft">DRAFT</option>
              <option value="under_review">UNDER_REVIEW</option>
              <option value="published">PUBLISHED</option>
              <option value="archived">ARCHIVED</option>
            </select>
          </div>

          <div className="col-span-12 md:col-span-3">
            <div className="text-xs text-gray-500 mb-1">ประเภท</div>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
            >
              <option value="">JOURNAL / CONFERENCE / BOOK</option>
              <option value="JOURNAL">JOURNAL</option>
              <option value="CONFERENCE">CONFERENCE</option>
              <option value="BOOK">BOOK</option>
            </select>
          </div>

          <div className="col-span-6 md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">ช่วงปี (จาก)</div>
            <input
              inputMode="numeric"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="2019"
            />
          </div>
          <div className="col-span-6 md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">ช่วงปี (ถึง)</div>
            <input
              inputMode="numeric"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="2025"
            />
          </div>

          <div className="col-span-6 md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">ไฟล์ PDF</div>
            <div className="flex gap-2">
              <button
                onClick={() => setHasPdf('all')}
                className={`px-4 py-2 rounded-xl text-sm border ${hasPdf === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-700'}`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => setHasPdf('1')}
                className={`px-4 py-2 rounded-xl text-sm border ${hasPdf === '1' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-700'}`}
              >
                มี
              </button>
            </div>
          </div>

          <div className="col-span-6 md:col-span-1 flex items-end">
            <button onClick={clearFilters} className="px-4 py-2 rounded-xl border w-full">
              ล้าง
            </button>
          </div>
        </div>
      </div>

      {/* ตารางผลลัพธ์ */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3">ชื่อ</th>
                <th className="px-3 py-3">ประเภท</th>
                <th className="px-3 py-3">ปี</th>
                <th className="px-3 py-3">สถานะ</th>
                <th className="px-3 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">กำลังโหลด...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">ไม่พบรายการ</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.pub_id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">
                        {r.title || r.venue_name || `#${r.pub_id}`}
                      </div>
                      {r.venue_name && (
                        <div className="text-xs text-zinc-500">{r.venue_name}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">{r.level || '-'}</td>
                    <td className="px-3 py-3">{r.year ?? '-'}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${STATUS_STYLE[r.status || 'draft']}`}>
                        {r.status || 'draft'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <Link href={`/professor/publications/${r.pub_id}`} className="px-2.5 py-1.5 text-xs rounded-lg border hover:bg-zinc-50">
                          ดู
                        </Link>
                        <Link href={`/professor/publications/${r.pub_id}/edit`} className="px-2.5 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                          แก้ไข
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* footer pagination */}
        <div className="flex items-center justify-between px-4 py-3 text-sm text-gray-600">
          <div>
            {total > 0
              ? <>แสดง {pageStart}-{pageEnd} จาก {total} รายการ</>
              : <>ไม่มีข้อมูล</>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg border disabled:opacity-50"
            >
              ก่อนหน้า
            </button>
            <div className="px-2 py-1">หน้า {page} / {Math.max(1, Math.ceil(total / pageSize))}</div>
            <button
              onClick={() => setPage((p) => p + 1)}
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
