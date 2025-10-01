// app/professor/manual/page.tsx
'use client';

export default function ProfessorManualPage() {
  // ไฟล์อยู่ที่ public/pdfs/professor-manual.pdf
  const pdfPath = '/pdfs/professor-manual.pdf';
  const pdfSrc = `${pdfPath}#toolbar=1&navpanes=0`; // เปิดด้วย toolbar แต่ซ่อน nav panes

  return (
    <div className="bg-white rounded-xl shadow p-4 h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">คู่มือการใช้งานสำหรับอาจารย์</h1>
        <a
          href={pdfPath}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg border hover:bg-zinc-50 text-sm"
          title="เปิดไฟล์เต็มหน้าต่าง"
        >
          เปิดไฟล์เต็มหน้าต่าง
        </a>
      </div>

      <object
        data={pdfSrc}
        type="application/pdf"
        className="w-full h-full rounded-lg border"
      >
        <p className="text-sm text-gray-600 p-4">
          เบราว์เซอร์ของคุณไม่รองรับการแสดง PDF ในหน้า
          กรุณา{' '}
          <a href={pdfPath} className="text-blue-600 underline" download>
            ดาวน์โหลดไฟล์
          </a>
        </p>
      </object>
    </div>
  );
}
