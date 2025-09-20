'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Row = {
  pub_id: number;
  title?: string | null;
  venue_name?: string | null;
  level?: string | null;   // JOURNAL/CONFERENCE/BOOK
  year?: number | null;
  status?: string | null;  // DRAFT/UNDER_REVIEW/PUBLISHED/ARCHIVED
};

const PAGE_SIZE = 10;
const STATUS_OPTIONS = ['DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED'] as const;
const LEVEL_OPTIONS  = ['JOURNAL', 'CONFERENCE', 'BOOK'] as const;

export default function ProfessorDashboardPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [level, setLevel] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [hasPdf, setHasPdf] = useState(false);
  const [onlyMine, setOnlyMine] = useState(true);
  const [withStudents, setWithStudents] = useState(false);

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(page * PAGE_SIZE, total);

  async function fetchData() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q) p.set('q', q);
      if (status) p.set('status', status);
      if (level) p.set('level', level);
      if (yearFrom) p.set('yearFrom', yearFrom);
      if (yearTo) p.set('yearTo', yearTo);
      if (hasPdf) p.set('hasPdf', '1');
      if (onlyMine) p.set('mine', '1');
      if (withStudents) p.set('withStudents', '1');
      p.set('page', String(page));
      p.set('pageSize', String(PAGE_SIZE));

      const res = await fetch('/api/professor/publications?' + p.toString(), { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'fetch failed');

      setRows(json.data || []);
      setTotal(json.total || 0);
    } catch (e: any) {
      console.error('load error:', e?.message || e);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [page]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchData();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* user info (มุมขวาบน) */}
      <div className="flex items-center justify-end px-6 py-3 text-sm text-gray-600">
        ผู้ใช้: <span className="font-semibold ml-1">somchai</span> (<span className="uppercase">PROFESSOR</span>)
      </div>

      <main className="px-6 pb-10 max-w-6xl mx-auto">
        <h1 className="text-lg font-semibold mb-4">จัดการงานตีพิมพ์</h1>

        {/* ค้นหาเร็ว + สร้างใหม่ */}
        <form onSubmit={submit} className="bg-white rounded-xl shadow p-4 mb-4">
          <div className="flex gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="พิมพ์คำค้นหา: ชื่อเรื่อง, DOI, ผู้เขียน..."
              className="flex-1 border rounded-xl px-4 py-2"
            />
            <button type="submit" className="px-6 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700">ค้นหา</button>
            <Link href="/professor/publications/new" className="px-6 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
              + สร้างผลงานใหม่
            </Link>
          </div>
        </form>

        {/* ตัวกรอง */}
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={() => setOnlyMine(v => !v)}
              className={`px-3 py-2 rounded-xl text-sm border ${onlyMine ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-700'}`}
            >
              เฉพาะงานของฉัน
            </button>
            <button
              type="button"
              onClick={() => setWithStudents(v => !v)}
              className={`px-3 py-2 rounded-xl text-sm border ${withStudents ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-700'}`}
            >
              มีนักศึกษาเป็นผู้ร่วม
            </button>
          </div>

          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-12 sm:col-span-4">
              <div className="text-xs text-gray-500 mb-1">สถานะ</div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border rounded-xl px-3 py-2">
                <option value="">DRAFT / UNDER_REVIEW / PUBLISHED / ARCHIVED</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-12 sm:col-span-4">
              <div className="text-xs text-gray-500 mb-1">ประเภท</div>
              <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full border rounded-xl px-3 py-2">
                <option value="">JOURNAL / CONFERENCE / BOOK</option>
                {LEVEL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-6 sm:col-span-2">
              <div className="text-xs text-gray-500 mb-1">ช่วงปี (จาก)</div>
              <input type="number" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
            </div>
            <div className="col-span-6 sm:col-span-2">
              <div className="text-xs text-gray-500 mb-1">ช่วงปี (ถึง)</div>
              <input type="number" value={yearTo} onChange={(e) => setYearTo(e.target.value)} className="w-full border rounded-xl px-3 py-2" />
            </div>
            <div className="col-span-12 sm:col-span-2">
              <div className="text-xs text-gray-500 mb-1">ไฟล์ PDF</div>
              <button
                type="button"
                onClick={() => setHasPdf(v => !v)}
                className={`w-full px-3 py-2 rounded-xl border ${hasPdf ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-700'}`}
              >
                {hasPdf ? 'มี' : 'ทั้งหมด'}
              </button>
            </div>

            <div className="col-span-12 sm:col-span-2 flex sm:justify-end">
              <button
                onClick={() => { setQ(''); setStatus(''); setLevel(''); setYearFrom(''); setYearTo(''); setHasPdf(false); setOnlyMine(true); setWithStudents(false); setPage(1); fetchData(); }}
                className="px-3 py-2 rounded-xl bg-gray-100"
              >
                ล้าง
              </button>
            </div>
          </div>
        </div>

        {/* ตารางผลลัพธ์ */}
        <div className="bg-white rounded-xl shadow">
          {loading ? (
            <div className="p-6 text-center text-gray-500">กำลังโหลด...</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-gray-500">ไม่พบผลลัพธ์</div>
          ) : (
            <div className="divide-y">
              <div className="px-4 py-2 text-sm text-gray-500 grid grid-cols-12">
                <div className="col-span-6">ชื่อ</div>
                <div className="col-span-2">ประเภท</div>
                <div className="col-span-1">ปี</div>
                <div className="col-span-1">สถานะ</div>
                <div className="col-span-2 text-right">จัดการ</div>
              </div>

              {rows.map(r => (
                <div key={r.pub_id} className="px-4 py-3 grid grid-cols-12 items-center">
                  <div className="col-span-6">
                    <div className="font-medium">{r.title || r.venue_name || `(รายการ #${r.pub_id})`}</div>
                    <div className="text-xs text-gray-500">{r.venue_name ?? ''}</div>
                  </div>
                  <div className="col-span-2 text-sm">{r.level ?? '-'}</div>
                  <div className="col-span-1 text-sm">{r.year ?? '-'}</div>
                  <div className="col-span-1"><StatusPill value={r.status} /></div>
                  <div className="col-span-2 flex justify-end gap-2">
                    <Link href={`/professor/publications/${r.pub_id}/edit`} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm">แก้ไข</Link>
                    <Link href={`/professor/publications/${r.pub_id}`} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm">ดู</Link>

                  </div>
                </div>
              ))}

              <div className="px-4 py-3 flex items-center justify-between text-sm text-gray-600">
                <div>แสดง {total ? `${showingFrom}-${showingTo}` : 0} จาก {total} รายการ</div>
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

function StatusPill({ value }: { value?: string | null }) {
  const v = (value || '').toUpperCase();
  const base = 'text-xs px-3 py-1 rounded-full inline-block select-none';
  if (v === 'PUBLISHED') return <span className={`${base} bg-green-100 text-green-700`}>เผยแพร่แล้ว</span>;
  if (v === 'UNDER_REVIEW') return <span className={`${base} bg-amber-100 text-amber-700`}>อยู่ระหว่างตรวจสอบ</span>;
  if (v === 'ARCHIVED') return <span className={`${base} bg-gray-100 text-gray-600`}>เก็บถาวร</span>;
  return <span className={`${base} bg-slate-100 text-slate-700`}>ฉบับร่าง</span>;
}
