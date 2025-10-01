'use client';

import { usePathname } from 'next/navigation';

function titleFromPath(p: string) {
  // จัดลำดับความเฉพาะเจาะจงก่อน
  if (p === '/professor/dashboard') return 'จัดการผลงานตีพิมพ์';
  if (p === '/professor/publications/new') return 'สร้างผลงานใหม่';
  if (/^\/professor\/publications\/\d+\/edit$/.test(p)) return 'แก้ไขผลงาน';
  if (/^\/professor\/publications\/\d+$/.test(p)) return 'รายละเอียดผลงาน';
  if (p.startsWith('/professor')) return 'พื้นที่อาจารย์';
  return '';
}

export default function TopBarTitle() {
  const pathname = usePathname();
  const title = titleFromPath(pathname);
  return (
    <div className="font-semibold text-zinc-800">
      {title || 'จัดการผลงานตีพิมพ์'}
    </div>
  );
}
