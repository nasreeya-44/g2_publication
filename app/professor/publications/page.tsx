// app/professor/publications/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type PubRow = {
  pub_id: number;
  pub_name?: string | null;    // ชื่อผลงานหลัก
  venue_name?: string | null;  // สำรองถ้าไม่มี pub_name
  level?: string | null;       // NATIONAL / INTERNATIONAL (หรือค่าที่คุณเก็บ)
  year?: number | null;
  status?: string | null;      // draft/under_review/published/archived
  link_url?: string | null;
};

const LEVEL_UI = [
  { label: 'ทุกระดับ', value: '' },
  { label: 'NATIONAL', value: 'NATIONAL' },
  { label: 'INTERNATIONAL', value: 'INTERNATIONAL' },
];

export default function ProfessorAllPublicationsPage() {
  // ฟิลเตอร์ (ไม่มีตัวเลือกสถานะ และไม่จำกัดเฉพาะ mine)
  const [q, setQ] = useState('');
  const [level, setLevel] = useState<string>(''); // NATIONAL / INTERNATIONAL
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [hasPdf, setHasPdf] = useState<'all' | '1'>('all');

  // ข้อมูล
  const [rows, setRows] = useState<PubRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // เพจจิเนชัน (client)
  const [page, setPage] = useState(1);
  const pageSize = 20;

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      // ✅ บังคับให้ API คืนเฉพาะ published เสมอ
      params.set('status', 'published');

      // ✅ ค้นหาทุกคน (ไม่ใส่ mine)
      if (q.trim()) params.set('q', q.trim());
      if (level) params.set('level', level);
      if (yearFrom) params.set('yearFrom', yearFrom);
      if (yearTo) params.set('yearTo', yearTo);
      if (hasPdf === '1') params.set('hasPdf', '1');

      const res = await fetch(`/api/professor/publications?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok) throw new Error(json?.message || 'load failed');

      setRows(json.data || []);
      setTotal(json.total || 0);
    } catch (e: any) {
      console.error('load error:', e);
      setRows([]);
      setTotal(0);
      setErr(e?.message || 'fetch failed');
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
    setLevel('');
    setYearFrom('');
    setYearTo('');
    setHasPdf('all');
    setPage(1);
    setTimeout(load, 0);
  }

  const pageFrom = (page - 1) * pageSize + 1;
  const pageTo = Math.min(page * pageSize, total);

  // ---------- Topbar chips (สรุปฟิลเตอร์ที่ใช้งาน) ----------
  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (q.trim()) chips.push({ key: 'q', label: `คำค้น: “${q.trim()}”`, clear: () => setQ('') });
    if (level) chips.push({ key: 'level', label: `ระดับ: ${level}`, clear: () => setLevel('') });
    if (yearFrom) chips.push({ key: 'yf', label: `ปีจาก: ${yearFrom}`, clear: () => setYearFrom('') });
    if (yearTo) chips.push({ key: 'yt', label: `ปีถึง: ${yearTo}`, clear: () => setYearTo('') });
    if (hasPdf === '1') chips.push({ key: 'pdf', label: 'มีไฟล์ PDF', clear: () => setHasPdf('all') });
    return chips;
  }, [q, level, yearFrom, yearTo, hasPdf]);

  return (
    <div className="px-6 pb-10 space-y-4">
      {/* ---------- TOPBAR ใหม่ ---------- */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            ผลงานทั้งหมด (Published)
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="inline-flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${loading ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {loading ? 'กำลังโหลด…' : `ทั้งหมด ${total} รายการ`}
            </span>
            {/* สรุปฟิลเตอร์ที่ใช้งาน */}
            {activeChips.length > 0 && (
              <>
                <span>• ตัวกรอง:</span>
                <div className="flex flex-wrap gap-2">
                  {activeChips.map((c) => (
                    <button
                      key={c.key}
                      onClick={c.clear}
                      className="group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-zinc-50"
                      title="คลิกเพื่อเคลียร์ตัวกรองนี้"
                    >
                      <span>{c.label}</span>
                      <span className="text-zinc-500 group-hover:text-rose-600">×</span>
                    </button>
                  ))}
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-zinc-50 hover:bg-zinc-100"
                    title="ล้างตัวกรองทั้งหมด"
                  >
                    ล้างทั้งหมด
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* โหมดดูอย่างเดียว: ไม่มีปุ่ม “สร้างใหม่” */}
        <div className="text-sm text-gray-500">
          โหมดดูอย่างเดียว — แสดงเฉพาะผลงานที่เผยแพร่แล้ว
        </div>
      </div>

      {/* ฟิลเตอร์ */}
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 lg:col-span-5">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหา: ชื่อผลงาน / venue / ลิงก์ / ผู้เขียน…"
              className="w-full border rounded-xl px-4 py-2"
            />
          </div>

          <div className="col-span-6 sm:col-span-4 lg:col-span-2">
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full border rounded-xl px-3 py-2">
              {LEVEL_UI.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="col-span-6 sm:col-span-2 lg:col-span-2">
            <input
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
              placeholder="ปีจาก"
              className="w-full border rounded-xl px-3 py-2"
            />
          </div>
          <div className="col-span-6 sm:col-span-2 lg:col-span-2">
            <input
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
              placeholder="ปีถึง"
              className="w-full border rounded-xl px-3 py-2"
            />
          </div>

          <div className="col-span-6 sm:col-span-2 lg:col-span-1">
            <select
              value={hasPdf}
              onChange={(e) => setHasPdf(e.target.value as 'all' | '1')}
              className="w-full border rounded-xl px-3 py-2"
            >
              <option value="all">ไฟล์ PDF: ทั้งหมด</option>
              <option value="1">ไฟล์ PDF: มี</option>
            </select>
          </div>

          <div className="col-span-12 flex justify-end gap-2">
            <button onClick={applyFilters} className="px-4 py-2 rounded-xl bg-blue-600 text-white">
              ค้นหา
            </button>
            <button onClick={clearFilters} className="px-4 py-2 rounded-xl border">
              ล้าง
            </button>
          </div>
        </div>
      </div>

      {/* ตาราง */}
      <div className="bg-white rounded-2xl shadow p-2">
        {err && (
          <div className="mx-2 my-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {err}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="text-left py-3 px-2 w-[45%]">ชื่อผลงาน</th>
                <th className="text-left px-2">ระดับ</th>
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
                rows.map((r) => {
                  const title = r.pub_name || r.venue_name || '(ไม่มีชื่อเรื่อง)';
                  const showVenue = r.venue_name && r.venue_name !== r.pub_name;
                  return (
                    <tr key={r.pub_id} className="border-b hover:bg-gray-50">
                      <td className="px-2 py-2">
                        <div className="font-medium">{title}</div>
                        {showVenue && <div className="text-xs text-gray-500">{r.venue_name}</div>}
                      </td>
                      <td className="px-2">{r.level || '-'}</td>
                      <td className="px-2">{r.year ?? '-'}</td>
                      <td className="px-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                          published
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        {/* ✅ ดูได้อย่างเดียว — ไม่มีปุ่มแก้ไข */}
                        <Link
                          href={`/professor/publications/${r.pub_id}`}
                          className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200"
                        >
                          ดู
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ส่วนท้าย (เพจจิเนชัน) */}
        <div className="flex items-center justify-between px-3 py-3 text-sm text-gray-600">
          <div>
            แสดง {total === 0 ? 0 : pageFrom}-{Math.min(pageTo, total)} จาก {total} รายการ
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 rounded-lg border disabled:opacity-50"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ก่อนหน้า
            </button>
            <button
              className="px-3 py-1 rounded-lg border disabled:opacity-50"
              disabled={pageTo >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              หน้าถัดไป
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
