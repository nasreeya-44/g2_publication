"use client";

import StaffSideRail from "@/components/StaffSideRail";
import UserDropdown from "@/components/UserDropdown";
import Link from "next/link";

export default function StaffManualPage() {
  const pdfPath = "/pdfs/manual-staff.pdf";

  return (
    <div className="min-h-screen bg-[#F6F9FC]">
      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 relative">
        <StaffSideRail />

        <main className="md:ml-[80px]">
          <h1 className="text-lg font-semibold mb-4">คู่มือสำหรับสตาฟ</h1>

          <div className="bg-white rounded-xl shadow p-4">
            {/* ปุ่ม action */}
            <div className="flex justify-end gap-2 mb-3">
              <a
                href={pdfPath}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50"
              >
                เปิดในแท็บใหม่
              </a>
              <a
                href={pdfPath}
                download="manual-staff.pdf"
                className="px-4 py-2 text-sm rounded-lg border bg-blue-600 text-white hover:bg-blue-700"
              >
                ดาวน์โหลด
              </a>
            </div>

            {/* PDF preview */}
            <iframe
              src={pdfPath}
              className="w-full h-[80vh] rounded-md"
            />
          </div>
        </main>
      </div>
    </div>
  );
}