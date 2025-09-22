'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type PubRow = {
  pub_id: number;
  title?: string | null;
  venue_name?: string | null;
  level?: string | null; // NATIONAL / INTERNATIONAL
  year?: number | null;
  status?: string | null; // draft/under_review/published/archived (ตาม DB)
  link_url?: string | null;
};

const STATUS_UI = [
  { label: 'ทั้งหมด', value: '' },
  { label: 'DRAFT / UNDER_REVIEW', value: 'UNDER_REVIEW' }, // รวม ๆ เพื่อ UI
  { label: 'PUBLISHED', value: 'PUBLISHED' },
  { label: 'ARCHIVED', value: 'ARCHIVED' },
];

const TYPE_UI = [
  { label: 'JOURNAL / CONFERENCE', value: '' }, // ปล่อยว่าง = ไม่กรอง
  { label: 'JOURNAL', value: 'JOURNAL' },
  { label: 'CONFERENCE', value: 'CONFERENCE' },
  { label: 'BOOK', value: 'BOOK' },
];

export default function ProfessorAllPublicationsPage() {
  // filters
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [level, setLevel] = useState<string>(''); // ใช้เป็นประเภท (JOURNAL/CONFERENCE/BOOK) ตามข้อมูลที่คุณส่งใน API เดิม
  const [yearFrom, setYearFrom] = useState<string>('2019');
  const [yearTo, setYearTo] = useState<string>('2025');
  const [hasPdf, setHasPdf] = useState<'ALL' | 'YES'>('ALL');

  // data
  const [rows, setRows] = useState<PubRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // pagination (client only)
  const [page, setPage] = useState(1);
  const pageSize = 20;

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('mine', '1'); // <<<<<< จำกัดเฉพาะงานของอาจารย์คนนี้
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      if (level) params.set('type', level); // API เดิมใช้ key "type"
      if (yearFrom) params.set('yearFrom', yearFrom);
      if (yearTo) params.set('yearTo', yearTo);
      if (hasPdf === 'YES') params.set('hasPdf', '1');

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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function applyFilters() {
    setPage(1);
    load();
  }
  function clearFilters() {
    setQ('');
    setStatus('');
    setLevel('');
    setYearFrom('2019');
    setYearTo('2025');
    setHasPdf('ALL');
    setPage(1);
    setTimeout(load, 0);
  }

  const pageFrom = (page - 1) * pageSize + 1;
  const pageTo = Math.min(page * pageSize, total);

  return (
    <div className="px-6 pb-10">
      {/* ชื่อหน้า */}
      <h1 className="text-lg font-semibold mb-4">ผลงานทั้งหมดของฉัน (ดูอย่างเดียว)</h1>

      {/* filters */}
      <div className="bg-white rounded-2xl shadow p-4 mb-4">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 lg:col-span-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="พิมพ์คำค้นหา: ชื่อเรื่อง, DOI, ผู้เขียน..."
              className="w-full border rounded-xl px-4 py-2"
            />
          </div>
          <div className="col-span-6 sm:col-span-4 lg:col-span-3">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border rounded-xl px-3 py-2">
              {STATUS_UI.map((s) => (
                <option key={s.label} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="col-span-6 sm:col-span-4 lg:col-span-3">
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full border rounded-xl px-3 py-2">
              {TYPE_UI.map((t) => (
                <option key={t.label} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="col-span-6 sm:col-span-2 lg:col-span-1">
            <input value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} placeholder="จากปี" className="w-full border rounded-xl px-3 py-2" />
          </div>
          <div className="col-span-6 sm:col-span-2 lg:col-span-1">
            <input value={yearTo} onChange={(e) => setYearTo(e.target.value)} placeholder="ถึงปี" className="w-full border rounded-xl px-3 py-2" />
          </div>
          <div className="col-span-6 sm:col-span-2 lg:col-span-1">
            <select value={hasPdf} onChange={(e) => setHasPdf(e.target.value as any)} className="w-full border rounded-xl px-3 py-2">
              <option value="ALL">ไฟล์ PDF: ทั้งหมด</option>
              <option value="YES">ไฟล์ PDF: มี</option>
            </select>
          </div>

          <div className="col-span-12 lg:col-span-12 flex gap-2 justify-end">
            <button onClick={applyFilters} className="px-4 py-2 rounded-xl bg-blue-600 text-white">ค้นหา</button>
            <button onClick={clearFilters} className="px-4 py-2 rounded-xl border">ล้าง</button>
          </div>
        </div>
      </div>

      {/* table */}
      <div className="bg-white rounded-2xl shadow p-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="text-left py-3 px-2 w-[45%]">ชื่อ</th>
                <th className="text-left px-2">ประเภท</th>
                <th className="text-left px-2">ปี</th>
                <th className="text-left px-2">สถานะ</th>
                <th className="text-right px-2">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-6 text-center text-gray-500">กำลังโหลด...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-gray-500">ไม่พบรายการ</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.pub_id} className="border-b">
                    <td className="px-2 py-2">
                      <div className="font-medium">{r.title || r.venue_name || '(ไม่มีชื่อเรื่อง)'}</div>
                      {r.venue_name && <div className="text-xs text-gray-500">{r.venue_name}</div>}
                    </td>
                    <td className="px-2">{r.level || '-'}</td>
                    <td className="px-2">{r.year ?? '-'}</td>
                    <td className="px-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100">{r.status || '-'}</span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      {/* ดูเท่านั้น: ไม่มีปุ่มแก้ไข */}
                      <Link href={`/professor/publications/${r.pub_id}`} className="px-3 py-1.5 rounded-lg bg-gray-100">
                        ดู
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between px-3 py-3 text-sm text-gray-600">
          <div>
            แสดง {total === 0 ? 0 : pageFrom}-{pageTo} จาก {total} รายการ
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 rounded-lg border" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ก่อนหน้า
            </button>
            <button className="px-3 py-1 rounded-lg border" disabled={pageTo >= total} onClick={() => setPage((p) => p + 1)}>
              หน้าถัดไป
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
