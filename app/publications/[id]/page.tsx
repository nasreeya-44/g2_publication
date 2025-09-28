'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

/* ================= Types ================= */
type Author = {
  name: string;
  email: string | null;
  affiliation: string | null;
  order: number | null;
  role: string | null;
};

type Detail = {
  pub_id: number;
  pub_name: string | null;
  abstract: string | null;
  level: string | null;
  year: number | null;
  has_pdf: boolean;
  file_path: string | null;
  status: string | null;
  link_url: string | null;
  venue_name: string | null;
  venue_type: string | null;
  created_at: string | null;
  updated_at: string | null;
  authors: Author[];
  categories: string[];
};

/* ================= Helpers ================= */
function fmtDate(s?: string | null) {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return s || '—';
  }
}

/* ================= Page (Client) ================= */
export default function PublicationDetailPage() {
  const params = useParams<{ id: string }>(); // ✅ ใช้ useParams แทน await params
  const id = params?.id;

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!id) return;
      setLoading(true);
      setErr(null);
      try {
        // ใช้ relative URL เพื่อให้ทำงานได้ทั้ง dev/prod
        const base = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
        const url = `${base}/api/publications/${encodeURIComponent(id)}`;
        const res = await fetch(url, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.message || `load detail failed (${res.status})`);
        }
        if (isMounted) setDetail(json as Detail);
      } catch (e: any) {
        if (isMounted) setErr(e?.message || 'ไม่สามารถโหลดข้อมูล');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // ============== UI ==============
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0B4CB8] via-[#205FDB] to-[#3A73E6]">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
          <TopBar />
          <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg ring-1 ring-black/5 p-10 text-center">
            <div className="animate-pulse text-slate-800">กำลังโหลดข้อมูล…</div>
          </div>
        </div>
      </div>
    );
  }

  if (err || !detail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0B4CB8] via-[#205FDB] to-[#3A73E6]">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
          <TopBar />
          <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg ring-1 ring-black/5 p-10 text-center">
            <h2 className="text-lg font-semibold text-slate-900">ไม่พบรายการที่ต้องการ</h2>
            <p className="text-sm text-gray-600 mt-1">
              {err || 'อาจถูกลบ/ไม่เปิดเผย หรือยังไม่ได้เผยแพร่'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const title =
    detail.pub_name || detail.venue_name || detail.link_url || `Publication #${detail.pub_id}`;

  const badges = [
    detail.level ? `ระดับ: ${detail.level}` : null,
    detail.year ? `ปี: ${detail.year}` : null,
    detail.status ? `สถานะ: ${detail.status}` : null,
    detail.venue_type ? `ประเภท: ${detail.venue_type}` : null,
    detail.has_pdf ? 'มี PDF' : null,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ======= Head Bar ======= */}
      <div className="bg-gradient-to-br from-[#0B4CB8] via-[#205FDB] to-[#3A73E6] py-6">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <TopBar />
        </div>
      </div>

      {/* ======= Body ======= */}
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6 mb-6">
          <h1 className="text-2xl font-semibold text-slate-900 break-words">{title}</h1>

          {detail.venue_name && (
            <div className="mt-1 text-sm text-gray-600 flex items-center gap-2">
              <BuildingIcon className="text-gray-400" />
              <span>แหล่งตีพิมพ์: {detail.venue_name}</span>
            </div>
          )}

          {badges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {badges.map((t, i) => (
                <Badge key={i}>{t}</Badge>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {detail.link_url && (
              <a
                href={detail.link_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700 transition"
              >
                📎 เปิดลิงก์
              </a>
            )}
            {detail.has_pdf && detail.file_path && (
              <a
                href={detail.file_path}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-sm hover:bg-slate-900 transition"
              >
                <FileIcon />
                เปิดไฟล์ PDF
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-5 items-start">
          {/* Left Column */}
          <section className="col-span-12 md:col-span-8 space-y-4">
            {/* Abstract */}
            {detail.abstract && (
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6 mb-4">
                <h2 className="text-base font-semibold text-slate-900 mb-3">บทคัดย่อ</h2>
                <p className="text-sm text-gray-700 whitespace-pre-line">{detail.abstract}</p>
              </div>
            )}

            {/* Authors */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-3">ผู้เขียน</h2>
              {detail.authors.length === 0 ? (
                <div className="text-sm text-gray-600">—</div>
              ) : (
                <ol className="list-decimal pl-5 space-y-1">
                  {detail.authors.map((a, i) => (
                    <li key={i} className="text-sm text-slate-800">
                      <span className="font-medium">{a.name}</span>
                      {a.affiliation ? <span className="text-gray-600"> — {a.affiliation}</span> : null}
                      {a.role ? <span className="text-gray-500"> ({a.role})</span> : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Categories */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-3">หมวดหมู่</h2>
              {detail.categories.length === 0 ? (
                <div className="text-sm text-gray-600">—</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {detail.categories.map((c, i) => (
                    <Chip key={i}>{c}</Chip>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Right Column (Sticky Meta) */}
          <aside className="col-span-12 md:col-span-4">
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6 md:sticky md:top-6">
              <h2 className="text-base font-semibold text-slate-900 mb-3">รายละเอียด</h2>
              <dl className="text-sm text-gray-800 space-y-2">
                <MetaRow label="ปี" value={detail.year ?? '—'} />
                <MetaRow label="ระดับ" value={detail.level ?? '—'} />
                <MetaRow label="แหล่งตีพิมพ์" value={detail.venue_name ?? '—'} />
                <MetaRow label="ประเภท" value={detail.venue_type ?? '—'} />
                <MetaRow label="สถานะ" value={detail.status ?? '—'} />
                <MetaRow label="สร้างเมื่อ" value={fmtDate(detail.created_at)} />
                <MetaRow label="แก้ไขเมื่อ" value={fmtDate(detail.updated_at)} />
              </dl>
            </div>
          </aside>
        </div>

        <div className="text-right mt-6">
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ◄ กลับสู่หน้าค้นหา
          </Link>
        </div>
      </main>
    </div>
  );
}

/* ================= Header Bar (shared) ================= */
function TopBar() {
  return (
    <div className="flex items-center justify-between text-white/90">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-white/15 grid place-items-center font-bold">P</div>
        <div>
          <div className="text-[15px] font-semibold">รายละเอียดผลงานตีพิมพ์</div>
          <div className="text-[12px] opacity-90">COMSCI PSU • Public Detail</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="text-sm bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3 py-1.5"
        >
          กลับสู่หน้าค้นหา
        </Link>
        <Link
          href="/login"
          className="text-sm bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3 py-1.5"
        >
          เข้าสู่ระบบ
        </Link>
      </div>
    </div>
  );
}

/* ================= Small UI Components ================= */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 text-[11px] rounded-full border bg-gray-50 text-gray-700 border-gray-200">
      {children}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] px-2 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200">
      {children}
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-slate-900">{value}</dd>
    </div>
  );
}

/* ===== Icons (SVG, no external deps) ===== */
function LinkIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 6" />
      <path d="M14 11a5 5 0 0 1-7.07 0L5.5 9.57a5 5 0 0 1 7.07-7.07L14 4" />
    </svg>
  );
}

function FileIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M13 2v6h6" />
    </svg>
  );
}

function BuildingIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3 21V5a2 2 0 0 1 2-2h6l6 4v14H3zM7 7h2v2H7V7zm0 4h2v2H7v-2zm0 4h2v2H7v-2zm4-8h2v2h-2V7zm0 4h2v2h-2v-2z" />
    </svg>
  );
}