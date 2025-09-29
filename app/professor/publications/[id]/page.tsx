// app/professor/publications/[id]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type Detail = {
  ok: true;
  pub_id: number;
  pub_name?: string | null;
  venue_name?: string | null;
  level?: string | null;
  year?: number | null;
  status?: string | null;
  link_url?: string | null;
  has_pdf?: boolean;
  file_path?: string | null;
  categories?: string[];
  authors?: Array<{
    full_name: string;
    email?: string | null;
    person_type?: string | null;
    role?: string | null;
    author_order?: number | null;
  }>;
};

export default function PublicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Detail | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/professor/publications/${id}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || json?.ok === false) throw new Error(json?.message || 'load failed');
        if (!cancelled) setData(json as Detail);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const title = useMemo(() => {
    if (!data) return '';
    return data.pub_name || data.venue_name || '(ไม่มีชื่อเรื่อง)';
  }, [data]);

  const authorLine = useMemo(() => {
    const list = (data?.authors || [])
      .slice()
      .sort((a, b) => (Number(a.author_order || 9999) - Number(b.author_order || 9999)))
      .map(a => a.full_name)
      .filter(Boolean);
    return list.join(', ');
  }, [data]);

  const hasPdf = !!data?.has_pdf && !!data?.file_path;
  const pdfPublicUrl = useMemo(() => {
    // ใช้ลิงก์ public ของ Supabase storage (ต้องตั้ง bucket publication_files เป็น public)
    if (!hasPdf || !data?.file_path) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL; // มี NEXT_PUBLIC จึงอ่านได้ฝั่ง client
    if (!base) return null;
    return `${base}/storage/v1/object/public/publication_files/${data.file_path}`;
  }, [data, hasPdf]);

  if (loading) {
    return <div className="px-6 py-10 text-sm text-gray-500">กำลังโหลดรายละเอียด…</div>;
  }
  if (err) {
    return (
      <div className="px-6 py-10">
        <div className="text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          {err}
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="px-6 py-10 text-sm text-gray-500">ไม่พบข้อมูล</div>;
  }

  return (
    <div className="px-6 pb-10 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>

          {/* ผู้เขียนทั้งหมด */}
          <div className="mt-1 text-sm text-zinc-600">
            {authorLine ? <>ผู้เขียน: {authorLine}</> : 'ผู้เขียน: —'}
          </div>

          {/* หมวดหมู่ */}
          {(data.categories && data.categories.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.categories.map((c, i) => (
                <span
                  key={`${c}-${i}`}
                  className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ปุ่มด้านขวา (ดูอย่างเดียว) */}
        <div className="flex flex-col items-end gap-2">
          {hasPdf && pdfPublicUrl && (
            <a
              href={pdfPublicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
              download
            >
              ดาวน์โหลด PDF
            </a>
          )}
          <button
            onClick={() => router.push('/professor/publications')}
            className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-zinc-50"
          >
            กลับไปหน้าผลงานทั้งหมด
          </button>
        </div>
      </div>

      {/* Content card */}
      <div className="bg-white rounded-2xl shadow p-5 space-y-4">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 sm:col-span-6">
            <div className="text-xs text-gray-500 mb-1">แหล่งตีพิมพ์ (Venue)</div>
            <div className="text-sm">{data.venue_name || '—'}</div>
          </div>
          <div className="col-span-6 sm:col-span-3">
            <div className="text-xs text-gray-500 mb-1">ระดับ</div>
            <div className="text-sm">{data.level || '—'}</div>
          </div>
          <div className="col-span-6 sm:col-span-3">
            <div className="text-xs text-gray-500 mb-1">ปี</div>
            <div className="text-sm">{data.year ?? '—'}</div>
          </div>

          <div className="col-span-12 sm:col-span-6">
            <div className="text-xs text-gray-500 mb-1">ลิงก์ / DOI</div>
            {data.link_url ? (
              <a
                href={data.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-700 hover:underline break-all"
              >
                {data.link_url}
              </a>
            ) : (
              <div className="text-sm">—</div>
            )}
          </div>

          <div className="col-span-12 sm:col-span-6">
            <div className="text-xs text-gray-500 mb-1">สถานะ</div>
            <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700">
              {data.status || '—'}
            </span>
          </div>
        </div>

        {/* ถ้ามี PDF แต่ bucket เป็น private: แจ้งเตือนทางเลือก */}
        {hasPdf && !pdfPublicUrl && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            พบไฟล์ PDF ในระบบ แต่ไม่สามารถสร้างลิงก์สาธารณะได้
            (โปรดตั้งค่า bucket <code>publication_files</code> ให้เป็น Public
            หรือทำ endpoint สำหรับสร้าง Signed URL แล้วเปลี่ยนปุ่มดาวน์โหลดให้เรียก endpoint นั้น)
          </div>
        )}
      </div>
    </div>
  );
}
