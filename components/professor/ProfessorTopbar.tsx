// components/professor/ProfessorTopbar.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import ProfileMenu from './ProfileMenu';

type Props = {
  name: string;
  role: string;
  avatarUrl?: string | null;
  profileHref?: string;
};

type NotiItem = {
  pub_id: number;
  title: string;
  venue_name: string | null;
  year: number | null;
  status: string;
  updated_at: string;
  latest_comment: string | null;
};

function getTitle(pathname: string, search: URLSearchParams) {
  const p = pathname.replace(/\/+$/, '');

  if (p === '/professor/dashboard') return 'จัดการผลงานตีพิมพ์';
  if (p === '/professor/publications') return 'ผลงานทั้งหมด (Published)';
  if (p === '/professor/publications/new') return 'สร้างผลงานใหม่';

  if (/^\/professor\/publications\/\d+(\/edit)?$/.test(p)) {
    if (p.endsWith('/edit') || search.get('edit') === '1') return 'แก้ไขผลงานตีพิมพ์';
    return 'ดูรายละเอียดผลงานตีพิมพ์';
  }

  if (p === '/professor/profile') return 'โปรไฟล์ของฉัน';

  return 'จัดการผลงานตีพิมพ์';
}

export default function ProfessorTopbar({ name, role, avatarUrl, profileHref }: Props) {
  const pathname = usePathname();
  const search = useSearchParams();
  const title = getTitle(pathname, search);

  // ====== Notifications state ======
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<NotiItem[]>([]);

  const notiCount = items.length;

  async function loadNotifications() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/professor/notifications', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.message || 'load failed');
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (e: any) {
      setItems([]);
      setErr(e?.message || 'โหลดการแจ้งเตือนไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
    const t = setInterval(loadNotifications, 60_000); // refresh ทุก 60 วินาที
    return () => clearInterval(t);
  }, []);

  const roleTitle = useMemo(() => {
    const r = (role || '').toUpperCase();
    return r === 'PROFESSOR' ? 'Professor' : r || 'User';
  }, [role]);

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="text-[15px] font-semibold text-zinc-800 truncate">{title}</div>

        <div className="flex items-center gap-3">
          {/* Notification bell */}
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="relative inline-flex items-center justify-center w-10 h-10 rounded-full border bg-white hover:bg-zinc-50"
              aria-label="notifications"
              title="งานที่ต้องแก้ไข (needs_revision)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5 text-zinc-700">
                <path
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 17h5l-1.4-1.4A4 4 0 0 1 17 13.8V11a5 5 0 0 0-10 0v2.8a4 4 0 0 1-1.6 1.8L4 17h5m2 4a2 2 0 0 0 2-2H9a2 2 0 0 0 2 2z"
                />
              </svg>
              {notiCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[11px] leading-[18px] text-center">
                  {notiCount > 99 ? '99+' : notiCount}
                </span>
              )}
            </button>

            {/* Dropdown */}
            <div
              className={`absolute right-0 mt-2 w-[360px] max-w-[90vw] bg-white border rounded-xl shadow-lg overflow-hidden ${open ? 'block' : 'hidden'}`}
            >
              <div className="px-3 py-2 border-b text-sm font-medium">งานที่ต้องแก้ไข (needs_revision)</div>

              {loading ? (
                <div className="px-3 py-4 text-sm text-gray-500">กำลังโหลด...</div>
              ) : err ? (
                <div className="px-3 py-4 text-sm text-rose-600">{err}</div>
              ) : items.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-500">ไม่มีรายการที่ต้องแก้ไข</div>
              ) : (
                <ul className="max-h-[60vh] overflow-auto">
                  {items.map((it) => (
                    <li key={it.pub_id} className="border-b last:border-b-0">
                      <Link
                        href={`/professor/publications/${it.pub_id}/edit`}
                        className="block px-3 py-3 hover:bg-zinc-50"
                        onClick={() => setOpen(false)}
                      >
                        <div className="font-medium text-zinc-900 truncate">{it.title}</div>
                        <div className="text-xs text-zinc-500 flex items-center gap-2">
                          <span>{it.venue_name || '-'}</span>
                          <span>•</span>
                          <span>{it.year ?? '-'}</span>
                        </div>
                        {it.latest_comment && (
                          <div className="mt-1 text-[13px] text-zinc-700 line-clamp-2">“{it.latest_comment}”</div>
                        )}
                        <div className="mt-1 text-[11px] text-zinc-400">
                          อัปเดตล่าสุด: {new Date(it.updated_at).toLocaleString()}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <div className="px-3 py-2 bg-zinc-50 text-right">
                <Link
                  href="/professor/dashboard?status=needs_revision"
                  className="text-xs text-indigo-700 hover:underline"
                  onClick={() => setOpen(false)}
                >
                  ดูทั้งหมด
                </Link>
              </div>
            </div>
          </div>

          {/* Profile menu (เดิม) */}
          <ProfileMenu
            name={name}
            role={roleTitle}
            avatarUrl={avatarUrl || undefined}
            profileHref={profileHref || '/professor/profile'}
          />
        </div>
      </div>
    </header>
  );
}
