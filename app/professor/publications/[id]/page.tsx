'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  abstract?: string | null;
  authors?: Array<{
    full_name: string;
    email?: string | null;
    person_type?: string | null;
    role?: string | null;
    author_order?: number | null;
  }>;
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  under_review: 'bg-amber-100 text-amber-800 border-amber-200',
  needs_revision: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  published: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  archived: 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

const LEVEL_BADGE: Record<string, string> = {
  NATIONAL: 'bg-blue-50 text-blue-800 border-blue-200',
  INTERNATIONAL: 'bg-purple-50 text-purple-800 border-purple-200',
};

export default function PublicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  // เก็บ referrer เผื่อใช้กรณีไม่มี ?from=
  const referrerRef = useRef<string>('');
  useEffect(() => {
    if (typeof document !== 'undefined') {
      referrerRef.current = document.referrer || '';
    }
  }, []);

  const goBackSmart = useCallback(() => {
    // ลำดับความสำคัญ:
    // 1) query ?from=all|dashboard|new
    // 2) history.back() ถ้ามีประวัติใน SPA
    // 3) document.referrer (กรณีเปลี่ยนหน้าแบบ full reload)
    // 4) fallback → dashboard
    const from = (searchParams.get('from') || '').toLowerCase();

    if (from === 'all') {
      return router.push('/professor/publications');
    }
    if (from === 'dashboard' || from === 'new') {
      return router.push('/professor/dashboard');
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      return router.back();
    }

    const refUrl = referrerRef.current;
    try {
      if (refUrl) {
        const u = new URL(refUrl, window.location.origin);
        if (u.origin === window.location.origin) {
          if (u.pathname.startsWith('/professor/publications')) {
            return router.push('/professor/publications');
          }
          if (u.pathname.startsWith('/professor/dashboard')) {
            return router.push('/professor/dashboard');
          }
        }
      }
    } catch {
      // ignore
    }

    return router.push('/professor/dashboard');
  }, [router, searchParams]);

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
        if (!res.ok || json?.ok === false) throw new Error(json?.message || 'โหลดข้อมูลไม่สำเร็จ');
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
      .sort((a, b) => (Number(a.author_order ?? 9999) - Number(b.author_order ?? 9999)))
      .map(a => a.full_name)
      .filter(Boolean);
    return list.join(', ');
  }, [data]);

  const hasPdf = !!data?.has_pdf && !!data?.file_path;
  const pdfPublicUrl = useMemo(() => {
    if (!hasPdf || !data?.file_path) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return null;
    return `${base}/storage/v1/object/public/publication_files/${data.file_path}`;
  }, [data, hasPdf]);

  const onCopy = useCallback(async (txt: string) => {
    try { await navigator.clipboard.writeText(txt); } catch {}
  }, []);

  if (loading) {
    return (
      <div className="px-6 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-64 bg-zinc-200 rounded" />
          <div className="h-4 w-96 bg-zinc-200 rounded" />
          <div className="h-4 w-72 bg-zinc-200 rounded" />
          <div className="h-56 w-full bg-white rounded-2xl shadow" />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="px-6 py-10">
        <div className="text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          {err}
        </div>
        <div className="mt-4">
          <button onClick={goBackSmart} className="px-3 py-2 rounded-lg border hover:bg-zinc-50 text-sm">
            กลับ
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-6 py-10 text-sm text-gray-600">
        ไม่พบข้อมูล
      </div>
    );
  }

  const stKey = (data.status || '').toLowerCase();
  const stClass = STATUS_BADGE[stKey] || STATUS_BADGE['draft'];
  const lvKey = (data.level || '').toUpperCase();
  const lvClass = LEVEL_BADGE[lvKey] || 'bg-zinc-50 text-zinc-700 border-zinc-200';

  return (
    <div className="px-6 pb-10 space-y-5">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="text-sm text-zinc-600">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/professor/publications" className="hover:underline">
                ผลงานทั้งหมด
              </Link>
            </li>
            <li className="text-zinc-400">/</li>
            <li className="text-zinc-900 font-medium">รายละเอียด</li>
          </ol>
        </nav>

        <div className="flex items-center gap-2">
          {hasPdf && pdfPublicUrl && (
            <>
              <a
                href={pdfPublicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                title="เปิดดู PDF"
              >
                เปิด PDF
              </a>
              <a
                href={pdfPublicUrl}
                download
                className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
                title="ดาวน์โหลด PDF"
              >
                ดาวน์โหลด PDF
              </a>
            </>
          )}
          <Link
            href={`/professor/publications/${data.pub_id}/edit`}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
          >
            แก้ไข
          </Link>
          <button
            onClick={goBackSmart}
            className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-zinc-50"
          >
            กลับ
          </button>
        </div>
      </div>

      {/* Title & Meta */}
      <header className="bg-white rounded-2xl shadow p-5">
        <h1 className="text-2xl font-semibold text-zinc-900 leading-snug">
          {title}
        </h1>

        {/* Authors */}
        <div className="mt-2 text-[15px] text-zinc-700">
          {authorLine ? <>ผู้เขียน: {authorLine}</> : 'ผู้เขียน: —'}
        </div>

        {/* Meta badges */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 border px-2.5 py-1 text-xs rounded-full ${stClass}`}>
            สถานะ: {data.status || '—'}
          </span>
          <span className={`inline-flex items-center gap-1 border px-2.5 py-1 text-xs rounded-full ${lvClass}`}>
            ระดับ: {data.level || '—'}
          </span>
          <span className="inline-flex items-center gap-1 border px-2.5 py-1 text-xs rounded-full bg-zinc-50 text-zinc-700 border-zinc-200">
            ปี: {data.year ?? '—'}
          </span>
        </div>

        {/* Categories */}
        {(data.categories && data.categories.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
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
      </header>

      {/* Layout */}
      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 lg:col-span-7 space-y-5">
          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">ข้อมูลทั่วไป</h2>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-6">
                <div className="text-xs text-gray-500 mb-1">แหล่งตีพิมพ์ (Venue)</div>
                <div className="text-sm">{data.venue_name || '—'}</div>
              </div>
              <div className="col-span-12 sm:col-span-6">
                <div className="text-xs text-gray-500 mb-1">ลิงก์ / DOI</div>
                {data.link_url ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={data.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-700 hover:underline break-all"
                    >
                      {data.link_url}
                    </a>
                    <button
                      onClick={() => onCopy(data.link_url!)}
                      className="px-2 py-1 text-xs rounded border hover:bg-zinc-50"
                      title="คัดลอกลิงก์"
                    >
                      คัดลอก
                    </button>
                  </div>
                ) : (
                  <div className="text-sm">—</div>
                )}
              </div>
            </div>

            {data.abstract ? (
              <div className="mt-4">
                <div className="text-xs text-gray-500 mb-1">บทคัดย่อ</div>
                <div className="text-sm leading-6 whitespace-pre-wrap">
                  {data.abstract}
                </div>
              </div>
            ) : null}
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">ผู้แต่ง</h2>
            {(data.authors && data.authors.length > 0) ? (
              <ol className="space-y-2">
                {data.authors
                  .slice()
                  .sort((a, b) => (Number(a.author_order ?? 9999) - Number(b.author_order ?? 9999)))
                  .map((a, idx) => {
                    const role = (a.role || '').toUpperCase();
                    const ptype = (a.person_type || '').toUpperCase();
                    const chips: string[] = [];
                    if (role) chips.push(role);
                    if (ptype) chips.push(ptype);
                    return (
                      <li key={`${a.full_name}-${idx}`} className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-sm text-zinc-900">{a.full_name}</div>
                          {a.email ? (
                            <a href={`mailto:${a.email}`} className="text-xs text-blue-700 hover:underline">
                              {a.email}
                            </a>
                          ) : (
                            <div className="text-xs text-zinc-500">—</div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {chips.map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border"
                            >
                              {c}
                            </span>
                          ))}
                          {Number.isFinite(a.author_order as any) && (
                            <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ลำดับ {a.author_order}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
              </ol>
            ) : (
              <div className="text-sm text-zinc-600">—</div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">หมวดหมู่</h2>
            {(data.categories && data.categories.length > 0) ? (
              <div className="flex flex-wrap gap-1.5">
                {data.categories.map((c, i) => (
                  <span
                    key={`${c}-${i}`}
                    className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border"
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-600">—</div>
            )}
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-5 space-y-5">
          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">ไฟล์ / เอกสาร</h2>

            {hasPdf ? (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {pdfPublicUrl ? (
                    <>
                      <a
                        href={pdfPublicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                        title="เปิดดู PDF"
                      >
                        เปิด PDF
                      </a>
                      <a
                        href={pdfPublicUrl}
                        download
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                        title="ดาวน์โหลด"
                      >
                        ดาวน์โหลด
                      </a>
                    </>
                  ) : (
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      พบไฟล์ในระบบ แต่ bucket ยังไม่เป็น Public (ไม่สามารถสร้างลิงก์สาธารณะ)
                    </span>
                  )}
                </div>

                {pdfPublicUrl ? (
                  <div className="rounded-lg border overflow-hidden">
                    <iframe
                      src={pdfPublicUrl}
                      className="w-full h-[520px]"
                      title="PDF Preview"
                    />
                  </div>
                ) : (
                  <div className="text-sm text-zinc-600">
                    หากต้องการพรีวิวในหน้านี้ โปรดตั้งค่า bucket <code>publication_files</code> ให้เป็น Public
                    หรือใช้ signed URL แล้วนำมาแสดงแทน
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-zinc-600">ไม่มีไฟล์แนบ</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
