// app/staff/dashboard/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StaffSideRail from "@/components/StaffSideRail";

/* ---------- types ---------- */
type Totals = {
  all: number;
  published: number;
  under_review: number;
  needs_revision: number;
  with_students: number;
};
type YearPoint = { year: number; count: number };
type TopAuthor = { name: string; published: number; under_review: number; total: number };
type DashboardResponse = {
  ok: boolean;
  data: {
    totals: Totals;
    byYear: YearPoint[];
    topAuthors: TopAuthor[];
    totalProfessors: number;
  };
};

/* ---------- UI helpers ---------- */
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 ${className}`}>
      {children}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  tone = "slate",
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "rose" | "blue";
}) {
  const toneMap: Record<string, string> = {
    slate: "bg-slate-50 text-slate-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    blue: "bg-blue-50 text-blue-600",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="text-[13px] text-gray-500">{label}</div>
        {icon ? <div className={`p-1.5 rounded-lg ${toneMap[tone]}`}>{icon}</div> : null}
      </div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
    </Card>
  );
}

export default function StaffDashboardPage() {
  const thisYear = new Date().getFullYear();

  // ตัวกรองสั้น ๆ ด้านบนแดชบอร์ด (เลือกช่วงปี)
  const [fromY, setFromY] = useState(thisYear - 4);
  const [toY, setToY] = useState(thisYear);

  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [byYear, setByYear] = useState<YearPoint[]>([]);
  const [topAuthors, setTopAuthors] = useState<TopAuthor[]>([]);
  const [totalProfessors, setTotalProfessors] = useState(0);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("year_from", String(fromY));
    p.set("year_to", String(toY));
    // สามารถเติมตัวกรองเพิ่มได้ถ้าต้องการ เช่น p.append("status","published")
    return p.toString();
  }, [fromY, toY]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/dashboard?${query}`, { cache: "no-store" });
      const j: DashboardResponse = await res.json();
      if (!res.ok || !j.ok) throw new Error(j as any);
      setTotals(j.data.totals);
      setByYear(j.data.byYear);
      setTopAuthors(j.data.topAuthors);
      setTotalProfessors(j.data.totalProfessors);
    } catch (e: any) {
      alert(e?.message || "โหลดแดชบอร์ดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const maxCount = useMemo(() => Math.max(1, ...byYear.map((x) => x.count)), [byYear]);

  return (
    <div className="min-h-screen bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 relative">
        <StaffSideRail />
        <main className="md:ml-[80px] space-y-5">
          {/* Header + filters */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                <span className="font-medium text-slate-700">Staff / Dashboard</span> – ภาพรวมระบบตีพิมพ์
              </h1>
              <div className="text-xs text-slate-500 mt-0.5">ข้อมูลสรุป • สถิติรายปี • Top Authors</div>
            </div>
            <div className="flex items-end gap-2">
              <div className="text-xs text-gray-500 mb-1">ช่วงปี</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={fromY}
                  onChange={(e) => setFromY(Number(e.target.value || thisYear))}
                />
                <span className="text-sm text-gray-500">–</span>
                <input
                  type="number"
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={toY}
                  onChange={(e) => setToY(Number(e.target.value || thisYear))}
                />
                <button
                  onClick={load}
                  disabled={loading}
                  className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
                >
                  {loading ? "กำลังโหลด…" : "อัปเดตข้อมูล"}
                </button>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid md:grid-cols-4 gap-4">
            <Kpi
              label="รอตรวจสอบ (Under Review)"
              value={totals?.under_review ?? 0}
              tone="amber"
              icon={<span>⏳</span>}
            />
            <Kpi
              label="ผ่านการอนุมัติแล้ว (Published)"
              value={totals?.published ?? 0}
              tone="green"
              icon={<span>✔️</span>}
            />
            <Kpi
              label="ต้องแก้ไข (Needs Revision)"
              value={totals?.needs_revision ?? 0}
              tone="rose"
              icon={<span>⚠️</span>}
            />
            <Kpi
              label="จำนวนอาจารย์ทั้งหมด"
              value={totalProfessors}
              tone="blue"
              icon={<span>👤</span>}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-12">
            {/* Chart */}
            <Card className="md:col-span-7 p-5">
              <div className="text-sm font-semibold text-slate-900">กราฟแนวโน้มงานตีพิมพ์รายปี</div>
              <div className="text-[11px] text-gray-400">จำนวนงาน/ปี</div>

              {byYear.length === 0 ? (
                <div className="p-8 text-sm text-gray-500">ไม่มีข้อมูล</div>
              ) : (
                <div className="h-64 flex items-end gap-6 px-2 mt-4">
                  {byYear.map((pt) => (
                    <div key={pt.year} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-10 bg-blue-500/80 rounded-t"
                        style={{ height: `${(pt.count / maxCount) * 220 + 10}px` }}
                        title={`${pt.year}: ${pt.count}`}
                      />
                      <div className="text-xs text-gray-600 mt-2">{pt.year}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 text-[11px] text-gray-400">
                * แสดงผลจากเงื่อนไขช่วงปีที่เลือกด้านบน
              </div>
            </Card>

            {/* Top Authors */}
            <Card className="md:col-span-5 p-5">
              <div className="text-sm font-semibold text-slate-900">Top Authors / Active Staff (รวมปี)</div>
              <div className="text-[11px] text-gray-400">เรียงตามจำนวนผลงานทั้งหมด</div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="px-3 py-2 text-left">ชื่อผู้แต่ง</th>
                      <th className="px-3 py-2 text-right">Published</th>
                      <th className="px-3 py-2 text-right">Under_review</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAuthors.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500">
                          ไม่มีข้อมูล
                        </td>
                      </tr>
                    ) : (
                      topAuthors.map((a, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{a.name}</td>
                          <td className="px-3 py-2 text-right text-emerald-600">{a.published}</td>
                          <td className="px-3 py-2 text-right text-amber-600">{a.under_review}</td>
                          <td className="px-3 py-2 text-right font-medium">{a.total}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Approved
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500" /> Pending
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-slate-400" /> Total
                </span>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}