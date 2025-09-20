'use client';

import Link from 'next/link';

const items = [
  { href: '/staff/dashboard', label: 'หน้าหลัก', icon: '🏠' },
  { href: '/staff/publications/new', label: 'เพิ่มผลงาน', icon: '➕' },
  { href: '/staff/search', label: 'ค้นหา', icon: '🔎' },
  { href: '/staff/profile', label: 'โปรไฟล์', icon: '👤' },
  { href: '/staff/filters', label: 'ตัวกรอง', icon: '🧰' },
  { href: '/staff/history', label: 'ประวัติ', icon: '⏱️' },
  { href: '/staff/library', label: 'คลัง', icon: '📚' },
  { href: '/staff/files', label: 'ไฟล์', icon: '🗂️' },
];

export default function SideNavMock() {
  return (
    <aside className="fixed left-4 top-24 z-10">
      <div className="flex flex-col gap-3">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            title={it.label}
            className="w-10 h-10 rounded-full border flex items-center justify-center bg-white shadow-sm hover:bg-slate-50"
          >
            <span className="text-[18px]" aria-hidden>{it.icon}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
