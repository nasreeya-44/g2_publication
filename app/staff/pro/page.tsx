// app/staff/pro/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StaffSideRail from "@/components/StaffSideRail";

type UserRow = {
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  position: string | null;
  status: "ACTIVE" | "SUSPENDED";
  email: string | null;
};

type ApiResponse = {
  ok: boolean;
  data: UserRow[];
  page: number;
  limit: number;
  total: number;
  message?: string;
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 ${className}`}>{children}</div>;
}

export default function StaffProIndexPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "ACTIVE" | "SUSPENDED">("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      if (status) p.set("status", status);
      p.set("page", String(page));
      p.set("limit", String(limit));

      const res = await fetch(`/api/staff/pro?${p.toString()}`, { cache: "no-store" });
      const j: ApiResponse = await res.json();
      if (!res.ok || !j.ok) throw new Error(j?.message || "load failed");

      setRows(j.data || []);
      setTotal(j.total || 0);
    } catch (e: any) {
      alert(e?.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [q, status, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  // เมื่อเปลี่ยนคีย์เวิร์ด/สถานะ ให้รีเซ็ตหน้าเป็น 1
  useEffect(() => {
    setPage(1);
  }, [q, status, limit]);

  return (
    <div className="min-h-screen bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 relative">
        <StaffSideRail />
        <main className="md:ml-[80px] space-y-5">
          {/* Header */}
          <div>
            <h1 className="text-[18px] font-semibold text-slate-900">ค้นหาอาจารย์</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              ค้นหาและดูข้อมูลอาจารย์ (อ่านอย่างเดียว) — ฟิลด์: user_id, username, first_name, last_name, phone, position, status, email
            </p>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                load();
              }}
              className="grid grid-cols-1 md:grid-cols-5 gap-3"
            >
              <div className="md:col-span-3">
                <div className="text-[11px] text-slate-500 mb-1">ค้นหา (ชื่อ/นามสกุล/ยูสเซอร์เนม/อีเมล/เบอร์)</div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="เช่น somchai / somchai@example.com / 08xx"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <div className="text-[11px] text-slate-500 mb-1">สถานะ</div>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">ทั้งหมด</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>

              <div>
                <div className="text-[11px] text-slate-500 mb-1">แสดงต่อหน้า</div>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-5 flex gap-2">
                <button
                  className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? "กำลังค้นหา…" : "ค้นหา"}
                </button>
                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm bg-gray-50"
                  onClick={() => {
                    setQ("");
                    setStatus("");
                    setLimit(20);
                    setPage(1);
                  }}
                >
                  ล้างตัวกรอง
                </button>
              </div>
            </form>
          </Card>

          {/* Result table */}
          <Card>
            <div className="px-4 py-2 border-b bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
              <div>ผลลัพธ์: {total.toLocaleString()} รายการ</div>
              {pages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    className="px-2 py-1 text-xs rounded border bg-white disabled:opacity-50"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    ‹ ก่อนหน้า
                  </button>
                  <div className="text-xs text-slate-600">
                    หน้า {page}/{pages}
                  </div>
                  <button
                    className="px-2 py-1 text-xs rounded border bg-white disabled:opacity-50"
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={page >= pages}
                  >
                    ถัดไป ›
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="p-6 text-sm text-gray-500">กำลังโหลด…</div>
            ) : rows.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">ไม่พบข้อมูล</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="px-3 py-2 text-left">ID</th>
                      <th className="px-3 py-2 text-left">Username</th>
                      <th className="px-3 py-2 text-left">ชื่อ</th>
                      <th className="px-3 py-2 text-left">นามสกุล</th>
                      <th className="px-3 py-2 text-left">อีเมล</th>
                      <th className="px-3 py-2 text-left">เบอร์โทร</th>
                      <th className="px-3 py-2 text-left">ตำแหน่ง</th>
                      <th className="px-3 py-2 text-left">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((u) => (
                      <tr key={u.user_id} className="border-t">
                        <td className="px-3 py-2">{u.user_id}</td>
                        <td className="px-3 py-2">{u.username || "-"}</td>
                        <td className="px-3 py-2">{u.first_name || "-"}</td>
                        <td className="px-3 py-2">{u.last_name || "-"}</td>
                        <td className="px-3 py-2">
                          {u.email ? (
                            <a className="text-blue-600 underline" href={`mailto:${u.email}`}>
                              {u.email}
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-2">{u.phone || "-"}</td>
                        <td className="px-3 py-2">{u.position || "-"}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-medium ${
                              u.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}