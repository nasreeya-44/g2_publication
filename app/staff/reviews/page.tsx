// app/staff/reviews/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import StaffSideRail from "@/components/StaffSideRail";

type Row = {
  id: number;
  title: string;
  type: string;
  level: string;
  year: number | null;
  venue: string | null;
  owner_name: string | null;
  status: string;        // "UNDER_REVIEW" | "NEEDS_REVISION" | ...
  updated_at: string | null;
};

export default function StaffReviewListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [onlyPending, setOnlyPending] = useState(true);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());

      if (onlyPending) {
        // ?status=under_review&status=needs_revision
        p.append("status", "under_review");
        p.append("status", "needs_revision");
      }

      const url = `/api/staff/reviews${p.toString() ? `?${p.toString()}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "load failed");
      setRows(j.data || []);
    } finally {
      setLoading(false);
    }
  }, [q, onlyPending]);

  useEffect(() => { load(); }, [load]);

  function Badge({ s }: { s: string }) {
    const S = s.toUpperCase();
    const cls =
      S === "UNDER_REVIEW"
        ? "bg-blue-100 text-blue-700"
        : S === "NEEDS_REVISION"
        ? "bg-orange-100 text-orange-700"
        : "bg-gray-100 text-gray-600";
    const label =
      S === "UNDER_REVIEW"
        ? "อยู่ระหว่างตรวจสอบ"
        : S === "NEEDS_REVISION"
        ? "ส่งคืนแก้ไข"
        : S;
    return (
      <span className={`inline-block px-2 py-1 rounded text-[10px] font-medium ${cls}`}>
        {label}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 relative">
        <StaffSideRail />
        <main className="md:ml-[80px]">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-sm font-semibold text-gray-800">รายการผลงานรอรีวิว</h1>
          </div>

          {/* ค้นหา + ฟิลเตอร์ */}
          <div className="mb-4 rounded-xl border bg-white shadow-sm p-4">
            <form
              onSubmit={(e) => { e.preventDefault(); load(); }}
              className="flex flex-wrap items-center gap-3"
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหาชื่อเรื่อง / Venue / Owner..."
                className="w-full md:flex-1 rounded-lg border px-3 py-2 text-sm"
              />
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={onlyPending}
                  onChange={() => setOnlyPending(!onlyPending)}
                />
                แสดงเฉพาะ “อยู่ระหว่างตรวจสอบ/รอแก้ไข”
              </label>
              <button className="rounded-lg border px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200">
                ค้นหา
              </button>
            </form>
          </div>

          {/* ตาราง */}
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="grid grid-cols-12 bg-gray-50 text-xs text-gray-500 px-4 py-2 border-b">
              <div className="col-span-9">ชื่อเรื่อง</div>
              <div className="col-span-2">อัปเดตล่าสุด</div>
              <div className="col-span-1 text-right">เปิดดู</div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-gray-500">กำลังโหลด…</div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">ไม่พบรายการ</div>
            ) : (
              rows.map((r, i) => (
                <div
                  key={r.id}
                  className={`grid grid-cols-12 items-center px-4 py-3 text-sm ${
                    i !== rows.length - 1 ? "border-b" : ""
                  }`}
                >
                  {/* ชื่อเรื่อง + venue + badge (ย้าย badge มาไว้ใต้ชื่อเรื่อง) */}
                  <div className="col-span-9">
                    <div className="font-medium text-gray-800 line-clamp-1">{r.title}</div>
                    <div className="text-xs text-gray-500">{r.venue || "-"}</div>
                    <div className="mt-1">
                      <Badge s={r.status} />
                    </div>
                  </div>


                  <div className="col-span-2 text-xs text-gray-600">
                    {r.updated_at ? new Date(r.updated_at).toLocaleDateString("th-TH") : "-"}
                  </div>

                  <div className="col-span-1 text-right">
                    <a
                      href={`/staff/reviews/${r.id}`}
                      className="inline-block rounded-lg px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700"
                    >
                      เปิดดู
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}