'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AdminGuidePDFPage() {
  const params = useSearchParams();

  // ใช้ query ?src=... ถ้าไม่ส่งมา จะ fallback เป็น /pdfs/manual.pdf
  const src = useMemo(() => {
    const q = params.get('src');
    return q && q.trim() ? q.trim() : '/pdfs/manual-admin.pdf';
  }, [params]);

  return (
    <div className="bg-white rounded-2xl shadow-md ring-1 ring-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <h2 className="text-sm font-semibold text-slate-900">คู่มือการใช้งาน</h2>
        <div className="flex gap-2">
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 text-xs rounded-lg border bg-white hover:bg-gray-50"
          >
            เปิดในแท็บใหม่
          </a>
          <a
            href={src}
            download
            className="px-3 py-1.5 text-xs rounded-lg border bg-white hover:bg-gray-50"
          >
            ดาวน์โหลด
          </a>
        </div>
      </div>

      {/* PDF Area */}
      <div className="h-[75vh]">
        <iframe src={src} className="w-full h-full" style={{ border: 'none' }} />
        <object data={src} type="application/pdf" className="w-full h-full hidden">
          <embed src={src} type="application/pdf" className="w-full h-full" />
        </object>
      </div>
    </div>
  );
}