// app/staff/search/[id]/page.tsx
'use client';

import { use, useEffect, useState } from 'react';
import StaffSideRail from '@/components/StaffSideRail';

type Author = { order: number; name: string; role: string; affiliation?: string | null };
type Detail = {
  id: number;
  title: string | null;
  level: string | null;
  year: number | null;
  venue_name: string | null;
  status: string;
  type: string | null;
  updated_at: string | null;
  link_url: string | null;
  abstract: string | null;
  tags: string[];
  authors: Author[];
};

export default function StaffSearchDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/staff/search/${id}`, { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok || !j?.ok) throw new Error(j?.message || 'load failed');

        if (alive) {
          // กันไม่ให้ authors/tags เป็น undefined
          const raw = j.data || {};
          setData({
            ...raw,
            authors: Array.isArray(raw.authors) ? raw.authors : [],
            tags: Array.isArray(raw.tags) ? raw.tags : [],
          });
        }
      } catch (e) {
        alert((e as any)?.message || 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">กำลังโหลด…</div>;
  }
  if (!data) {
    return <div className="p-8 text-sm text-rose-600">ไม่พบข้อมูล</div>;
  }

  return (
    <div className="min-h-screen bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 relative">
        <StaffSideRail />
        <main className="md:ml-[80px] space-y-5">
          {/* หัวเรื่อง */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5">
            <div className="text-2xl font-semibold text-slate-900">
              {data.title || '(ไม่ระบุชื่อเรื่อง)'}
            </div>
            <div className="mt-2 text-sm text-gray-700">
              แหล่งตีพิมพ์: {data.venue_name || '-'}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.level && <span className="text-xs rounded-full bg-gray-100 border px-3 py-1">ระดับ: {data.level}</span>}
              {typeof data.year === 'number' && <span className="text-xs rounded-full bg-gray-100 border px-3 py-1">ปี: {data.year}</span>}
              {data.status && <span className="text-xs rounded-full bg-gray-100 border px-3 py-1">สถานะ: {data.status}</span>}
              {data.type && <span className="text-xs rounded-full bg-gray-100 border px-3 py-1">ประเภท: {data.type}</span>}
            </div>

            {data.link_url && (
              <div className="mt-4">
                <a href={data.link_url} target="_blank" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2">
                  🔗 เปิดลิงก์
                </a>
              </div>
            )}
          </div>

          {/* บทคัดย่อ */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5">
            <div className="text-sm font-semibold mb-2">บทคัดย่อ</div>
            <div className="text-sm text-gray-700 whitespace-pre-line">
              {data.abstract || '-'}
            </div>
          </div>

          {/* ผู้เขียน */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5">
            <div className="text-sm font-semibold mb-3">ผู้เขียน</div>
            <div className="space-y-1 text-sm">
              {(data.authors?.length ?? 0) > 0 ? (
                data.authors.map((a) => (
                  <div key={a.order}>
                    {a.order}. {a.name}{' '}
                    {a.role ? <span className="text-xs text-gray-500">({a.role})</span> : null}
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">-</div>
              )}
            </div>
          </div>

          {/* หมวดหมู่ */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5">
            <div className="text-sm font-semibold mb-3">หมวดหมู่</div>
            <div className="flex flex-wrap gap-2">
              {(data.tags?.length ?? 0) > 0 ? (
                data.tags.map((t) => (
                  <span key={t} className="text-xs rounded-full bg-gray-100 border px-3 py-1">{t}</span>
                ))
              ) : (
                <span className="text-sm text-gray-500">-</span>
              )}
            </div>
          </div>

          <div>
            <a href="/staff/search" className="text-blue-600 text-sm">◀ กลับสู่หน้าค้นหา</a>
          </div>
        </main>
      </div>
    </div>
  );
}