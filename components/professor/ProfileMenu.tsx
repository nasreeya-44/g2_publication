// components/professor/ProfileMenu.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

type Props = {
  name: string;
  role: string; // ADMIN | STAFF | PROFESSOR (แสดงผล)
  avatarUrl: string;
  profileHref?: string; // default -> /professor/profile
};

export default function ProfileMenu({
  name,
  role,
  avatarUrl,
  profileHref = '/professor/profile',
}: Props) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  // คลิกนอกเพื่อปิด
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  async function logout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {}
    router.push('/login');
  }

  return (
    <div ref={ref} className="relative">
      {/* ปุ่มโปรไฟล์ — กำหนด h-11 และจัดให้กึ่งกลางด้วย items-center */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 h-11 rounded-2xl border bg-white px-3 shadow-sm hover:shadow transition"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="relative h-9 w-9 shrink-0">
          <Image
            src={avatarUrl}
            alt="avatar"
            fill
            sizes="36px"
            className="rounded-full object-cover ring-2 ring-indigo-100"
          />
        </div>
        <div className="text-left leading-5">
          <div className="text-sm font-medium text-zinc-900 truncate max-w-[160px]">
            {name}
          </div>
          <div className="text-[11px] uppercase text-zinc-500">{role}</div>
        </div>
      </button>

      {/* เมนูหล่นลง — ขยับลง mt-3 เพื่อไม่ชนขอบล่างของ Topbar */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-3 w-72 rounded-2xl border bg-white p-4 shadow-xl"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="relative h-10 w-10 shrink-0">
              <Image
                src={avatarUrl}
                alt="avatar"
                fill
                sizes="40px"
                className="rounded-full object-cover ring-2 ring-indigo-100"
              />
            </div>
            <div className="leading-5">
              <div className="font-medium text-zinc-900 truncate">{name}</div>
              <div className="text-xs text-zinc-500 lowercase">
                {role.toLowerCase()}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => {
                setOpen(false);
                router.push(profileHref);
              }}
              className="w-full rounded-xl border px-4 py-2.5 text-sm hover:bg-zinc-50"
            >
              ดูโปรไฟล์
            </button>
            <button
              onClick={logout}
              className="w-full rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700 hover:bg-rose-100"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
