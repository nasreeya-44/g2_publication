// components/professor/ProfessorSidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = {
  label: string;
  href: string;
  exact?: boolean;
  Icon: (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
};

/* ====== ไอคอนแบบ SVG ภายในไฟล์ ====== */
const IconHome = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      d="M3 11.5 12 4l9 7.5v6.5a2 2 0 0 1-2 2h-3.5a1.5 1.5 0 0 1-1.5-1.5V16a1.5 1.5 0 0 0-1.5-1.5h-1A1.5 1.5 0 0 0 10 16v3A1.5 1.5 0 0 1 8.5 20H5a2 2 0 0 1-2-2v-6.5z"/>
  </svg>
);
const IconList = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path strokeWidth="1.8" strokeLinecap="round" d="M8 6h12M8 12h12M8 18h12"/>
    <circle cx="4" cy="6" r="1.5" strokeWidth="1.8"/>
    <circle cx="4" cy="12" r="1.5" strokeWidth="1.8"/>
    <circle cx="4" cy="18" r="1.5" strokeWidth="1.8"/>
  </svg>
);
const IconPlus = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path strokeWidth="1.8" strokeLinecap="round" d="M12 5v14M5 12h14"/>
  </svg>
);
const IconUser = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path strokeWidth="1.8" strokeLinecap="round"
      d="M4 20a8 8 0 0 1 16 0M12 12a5 5 0 1 0-0.001-10.001A5 5 0 0 0 12 12z"/>
  </svg>
);
/* ไอคอนหนังสือสำหรับ “คู่มือการใช้งาน (อาจารย์)” */
const IconBook = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H7a3 3 0 0 0-3 3V5.5z" />
    <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      d="M7 3v16M10 7h7M10 11h7" />
  </svg>
);
/* ===================================== */

const NAV: Item[] = [
  { label: 'จัดการผลงาน',   href: '/professor/dashboard',        exact: true, Icon: IconHome },
  { label: 'ผลงานทั้งหมด',   href: '/professor/publications',     exact: true, Icon: IconList }, // ถ้ามีเพจแยก ค่อยเปลี่ยน href
  { label: 'สร้างผลงานใหม่', href: '/professor/publications/new', exact: true, Icon: IconPlus },
  { label: 'คู่มือการใช้งาน (อาจารย์)', href: '/professor/manual', exact: true, Icon: IconBook }, // ⬅️ เมนูใหม่
  { label: 'ข้อมูลส่วนตัว',  href: '/professor/profile',          exact: true, Icon: IconUser },
];

function isActive(path: string, it: Item) {
  return it.exact ? path === it.href : path.startsWith(it.href);
}

export default function ProfessorSidebar() {
  const pathname = usePathname();

  return (
    <nav className="space-y-2">
      {NAV.map((it) => {
        const active = isActive(pathname, it);
        return (
          <Link
            key={it.label}
            href={it.href}
            className={
              'flex items-center gap-3 px-4 py-2 rounded-xl border transition ' +
              (active
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-zinc-700 hover:bg-zinc-50')
            }
          >
            <it.Icon
              width={18}
              height={18}
              className={active ? 'text-white' : 'text-zinc-500'}
            />
            <span className="text-sm">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
