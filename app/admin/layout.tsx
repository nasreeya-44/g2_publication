'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/* ========== Types ========== */
type Role = 'ADMIN' | 'STAFF' | 'PROFESSOR';
type Status = 'ACTIVE' | 'SUSPENDED';
type Me = {
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  role: Role;
  status: Status;
  profile_image?: string | null;
};

/* ========== Small utils ========== */
async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    try {
      const t = await res.text();
      throw new Error(`non-JSON ${res.status}: ${t.slice(0, 200)}`);
    } catch {
      throw new Error(`non-JSON ${res.status}`);
    }
  }
  return res.json();
}

/* ========== Small UI ========== */
function Avatar({ url, size = 28 }: { url?: string | null; size?: number }) {
  const s = `${size}px`;
  return (
    <div
      className="rounded-full bg-gray-200 overflow-hidden flex items-center justify-center shrink-0"
      style={{ width: s, height: s }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="avatar" className="w-full h-full object-cover" />
      ) : (
        <svg viewBox="0 0 24 24" width={Math.floor(size * 0.6)} height={Math.floor(size * 0.6)} className="text-gray-400">
          <path
            fill="currentColor"
            d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5.33 0-8 2.667-8 6v1h16v-1c0-3.333-2.67-6-8-6z"
          />
        </svg>
      )}
    </div>
  );
}

/* ========== Sidebar Item (with hover label) ========== */
function SidebarItem({
  title,
  active,
  onClick,
  children,
}: {
  title: string;        // ข้อความไทยที่จะแสดงตอน hover
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode; // icon
}) {
  return (
    <div className="relative group/item">
      {/* ปุ่มไอคอน */}
      <button
        aria-label={title}
        title={title}
        onClick={onClick}
        className={`w-12 h-12 rounded-full border flex items-center justify-center transition
          ${active ? 'bg-[#173E8F] text-white border-[#173E8F]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
      >
        {children}
      </button>

      {/* ป้ายชื่อภาษาไทย โผล่ทางขวาเมื่อ hover */}
      <div
        className={`
          pointer-events-none
          absolute left-[64px] top-1/2 -translate-y-1/2
          whitespace-nowrap
          rounded-lg border bg-white text-slate-800 text-xs font-medium
          px-3 py-1.5 shadow-md
          opacity-0 translate-x-2
          transition-all duration-150
          group-hover/item:opacity-100 group-hover/item:translate-x-0
        `}
      >
        {title}
      </div>
    </div>
  );
}

/* ========== Title mapping ตาม path ========== */
const TITLE_MAP: Array<{ test: (p: string) => boolean; title: string }> = [
  { test: (p) => p === '/admin' || p === '/admin/dashboard', title: 'หน้าหลัก' },
  { test: (p) => p.startsWith('/admin/users'), title: 'จัดการบัญชีผู้ใช้' },
  { test: (p) => p.startsWith('/admin/guide'), title: 'คู่มือสำหรับแอดมิน' },
  { test: (p) => p.startsWith('/admin/logs') || p.startsWith('/admin/audit'), title: 'ประวัติการเข้าใช้งาน' },
  { test: (p) => p.startsWith('/admin/profile'), title: 'โปรไฟล์ของฉัน' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // โหลดข้อมูลผู้ใช้ปัจจุบัน
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        if (!res.ok) throw new Error('cannot load me');
        const json = await safeJson(res);
        const u = json?.data || json;
        setMe({
          user_id: u.user_id,
          username: u.username ?? null,
          first_name: u.first_name ?? null,
          last_name: u.last_name ?? null,
          role: u.role as Role,
          status: u.status as Status,
          profile_image: u.profile_image ?? null,
        });
      } catch {
        setMe((m) => m ?? {
          user_id: 0,
          username: 'guest@example.com',
          first_name: 'Guest',
          last_name: 'User',
          role: 'ADMIN',
          status: 'ACTIVE',
          profile_image: null
        });
      }
    })();
  }, []);

  const title = TITLE_MAP.find((r) => r.test(pathname))?.title ?? 'หน้าหลัก';

  const isActive = (t: 'home' | 'guide' | 'users' | 'logs') => {
    if (t === 'home') return pathname === '/admin' || pathname === '/admin/dashboard';
    if (t === 'guide') return pathname.startsWith('/admin/guide');
    if (t === 'users') return pathname.startsWith('/admin/users');
    if (t === 'logs') return pathname.startsWith('/admin/logs') || pathname.startsWith('/admin/audit');
    return false;
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      {/* Sidebar */}
      <aside className="fixed left-4 top-16 z-30">
        <div className="w-[56px] rounded-[20px] p-2 bg-white/80 backdrop-blur border border-gray-200 flex flex-col items-center gap-4 shadow-sm">
          {/* Home */}
          <SidebarItem
            title="หน้าหลัก"
            active={isActive('home')}
            onClick={() => router.push('/admin/dashboard')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 10.5l9-7 9 7V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-9.5z" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </SidebarItem>

          {/* Guide */}
          <SidebarItem
            title="คู่มือสำหรับแอดมิน"
            active={isActive('guide')}
            onClick={() => router.push('/admin/guide')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 4h10a2 2 0 0 1 2 2v12a.5.5 0 0 1-.8.4L13 15H7a2 2 0 0 1-2-2V4z" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </SidebarItem>

          {/* Users */}
          <SidebarItem
            title="จัดการบัญชีผู้ใช้"
            active={isActive('users')}
            onClick={() => router.push('/admin/users')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M16 14c2.761 0 5 2.239 5 5v2H3v-2c0-2.761 2.239-5 5-5h8zM12 12a5 5 0 100-10 5 5 0 000 10z" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </SidebarItem>

          {/* Logs */}
          <SidebarItem
            title="ประวัติการเข้าใช้งาน"
            active={isActive('logs')}
            onClick={() => router.push('/admin/logs')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 8v5l3 2M4 12a8 8 0 1 0 16 0A8 8 0 0 0 4 12z" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </SidebarItem>
        </div>
      </aside>

      {/* Content wrapper */}
      <div className="pl-[88px] pr-6 pt-6 pb-10">
        {/* Topbar */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[18px] font-semibold text-slate-900">{title}</h1>
          </div>

          {/* Profile Badge + Menu */}
          <ProfileMenu me={me} />
        </div>

        {/* Page content */}
        <div className="min-h-[70vh]">{children}</div>
      </div>
    </div>
  );
}

/* โปรไฟล์มุมขวาบน + เมนู ดูโปรไฟล์ / ออกจากระบบ */
function ProfileMenu({ me }: { me: Me | null }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative">
      <button
        aria-label="เปิดเมนูโปรไฟล์"
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50 shadow-sm"
        title="โปรไฟล์"
      >
        <Avatar url={me?.profile_image} size={28} />
        <div className="text-left leading-4">
          <div className="text-sm font-medium text-slate-900">
            {me?.first_name} {me?.last_name}
          </div>
          <div className="text-[11px] text-gray-500 uppercase">{me?.role}</div>
        </div>
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-72 rounded-xl border bg-white shadow-xl p-4">
            <div className="flex items-center gap-3">
              <Avatar url={me?.profile_image} size={40} />
              <div className="text-sm">
                <div className="font-medium">
                  {me?.first_name} {me?.last_name}
                </div>
                <div className="text-xs text-gray-500">{me?.username}</div>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  router.push('/admin/profile');
                }}
                className="w-full text-sm px-3 py-2 rounded-lg border hover:bg-gray-50"
              >
                ดูโปรไฟล์
              </button>
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  // TODO: แทนด้วย logic ออกจากระบบจริงของคุณ
                  await fetch('/api/logout', { method: 'POST' }); router.push('/login');
                }}
                className="w-full text-sm px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}