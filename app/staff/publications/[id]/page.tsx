'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';

type Detail = {
  ok: boolean;
  pub_id: number;
  link_url?: string | null;
  level?: string | null;
  year?: number | null;
  has_pdf?: boolean | null;
  file_path?: string | null;
  venue_id?: number | null;
  venue_name?: string | null;
  venue_type?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
  authors: { name: string; email: string | null; affiliation: string | null; order: number | null; role: string | null }[];
  categories: string[];
};

export default function StaffPublicationDetail(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = use(params); // ← คลาย Promise ก่อน
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/staff/publications/${id}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || json?.ok === false) throw new Error(json?.message || 'load failed');
        setData({ ok: true, authors: [], categories: [], ...json });
      } catch (e: any) {
        setErr(e?.message || String(e));
      }
    })();
  }, [id]);

  if (err) return (
    <div className="min-h-screen p-6">
      <div className="mb-4"><Link href="/staff/dashboard" className="text-blue-600">← กลับ</Link></div>
      <div className="p-6 rounded-xl border bg-red-50 text-red-700">เกิดข้อผิดพลาด: {err}</div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen p-6">
      <div className="mb-4"><Link href="/staff/dashboard" className="text-blue-600">← กลับ</Link></div>
      <div className="p-6 rounded-xl border bg-white">กำลังโหลด...</div>
    </div>
  );

  return (
    <div className="min-h-screen p-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/staff/dashboard" className="text-blue-600">← กลับ</Link>
        <Link href={`/staff/publications/${data.pub_id}/edit`} className="px-3 py-2 rounded-lg bg-gray-800 text-white text-sm">แก้ไข</Link>
      </div>

      <div className="bg-white rounded-xl shadow p-6 max-w-4xl">
        <h1 className="text-lg font-semibold mb-2">{data.venue_name || `ผลงาน #${data.pub_id}`}</h1>
        <div className="text-sm text-gray-600 mb-4">ประเภท: {data.venue_type ?? '-'} · ระดับ: {data.level ?? '-'} · ปี: {data.year ?? '-'}</div>

        <div className="mb-4">
          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 mr-2">สถานะ: {data.status ?? '-'}</span>
          {data.has_pdf ? <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700">มี PDF</span>
                        : <span className="text-xs px-3 py-1 rounded-full bg-gray-100">ไม่มี PDF</span>}
        </div>

        {data.link_url && (
          <div className="mb-4 text-sm">
            แหล่งตีพิมพ์/ลิงก์: <a className="text-blue-600 underline" href={data.link_url} target="_blank">{data.link_url}</a>
          </div>
        )}

        <div className="mb-4">
          <div className="font-medium mb-1">ผู้เขียน</div>
          <ul className="list-disc list-inside text-sm text-gray-700">
            {data.authors?.length ? data.authors.map((a, i) =>
              <li key={i}>{a.name}{a.affiliation ? ` — ${a.affiliation}` : ''}</li>
            ) : <li className="text-gray-400">—</li>}
          </ul>
        </div>

        <div className="mb-2">
          <div className="font-medium mb-1">หมวดหมู่</div>
          <div className="flex flex-wrap gap-2">
            {data.categories?.length ? data.categories.map((c, i) =>
              <span key={i} className="text-xs px-2 py-1 rounded bg-gray-100">{c}</span>
            ) : <span className="text-xs text-gray-400">—</span>}
          </div>
        </div>

        <div className="text-xs text-gray-500 mt-6">อัพเดตล่าสุด: {data.updated_at?.replace('T',' ').slice(0,16) ?? '-'}</div>
      </div>
    </div>
  );
}
