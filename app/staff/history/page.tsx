// app/staff/history/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StaffSideRail from "@/components/StaffSideRail";

/* ---------------- Icons (no extra libs) ---------------- */
const Icon = {
  Search: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Calendar: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  ArrowRight: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
};

/* ---------------- Types ---------------- */
type Row = {
  id: number;                 // edit_id
  when: string;               // edited_at (ISO)
  pub_id: number;
  pub_name: string | null;
  user: string;               // ชื่อผู้แก้ไข (อาจเป็น "-" ถ้าไม่ทราบ)
  field: string;              // field_name
  old_value: string | null;
  new_value: string | null;
  status_after?: string | null;
};

/* ---------------- Small helpers ---------------- */
function formatDT(s?: string) {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return s;
  }
}

function FieldChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2 py-[2px] text-[10px] font-medium">
      {name}
    </span>
  );
}

function Diff({ oldV, newV }: { oldV: string | null; newV: string | null }) {
  return (
    <div className="mt-1 flex items-center gap-2 text-[13px]">
      <span className="inline-flex px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 max-w-[18rem] truncate">
        {oldV ?? "—"}
      </span>
      <Icon.ArrowRight className="text-slate-400" />
      <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 max-w-[18rem] truncate">
        {newV ?? "—"}
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="px-4 py-4 border-b last:border-0">
      <div className="h-3 w-40 bg-gray-200 rounded animate-pulse" />
      <div className="mt-2 h-4 w-72 bg-gray-200 rounded animate-pulse" />
      <div className="mt-2 h-3 w-64 bg-gray-200 rounded animate-pulse" />
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function HistorySimple() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      if (from) p.set("from", from);
      if (to) p.set("to", to);

      const res = await fetch(`/api/staff/history?${p.toString()}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "load failed");
      setRows(Array.isArray(j.data) ? j.data : []);
    } finally {
      setLoading(false);
    }
  }, [q, from, to]);

  useEffect(() => { load(); }, [load]);

  // สถิติสั้น ๆ ด้านบน
  const stat = useMemo(() => {
    const total = rows.length;
    const fields = new Set(rows.map(r => r.field));
    return { total, fields: fields.size };
  }, [rows]);

  return (
    <div className="min-h-screen bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 relative">
        <StaffSideRail />
        <main className="md:ml-[80px] space-y-5">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[18px] font-semibold text-slate-900">ประวัติการจัดการผลงานตีพิมพ์</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                ตรวจดูการแก้ไขค่าต่าง ๆ (field) ของผลงานทุกชิ้น พร้อมกรองตามคำค้น/ช่วงเวลา
              </p>
            </div>
            {/* สถิติย่อ */}
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-white border shadow-sm px-3 py-2 text-center">
                <div className="text-[11px] text-slate-500">จำนวนเหตุการณ์</div>
                <div className="text-sm font-semibold text-slate-900">{stat.total}</div>
              </div>
              <div className="rounded-xl bg-white border shadow-sm px-3 py-2 text-center">
                <div className="text-[11px] text-slate-500">จำนวนฟิลด์ที่มีการแก้</div>
                <div className="text-sm font-semibold text-slate-900">{stat.fields}</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <form
              onSubmit={(e) => { e.preventDefault(); load(); }}
              className="grid grid-cols-1 md:grid-cols-5 gap-3"
            >
              {/* search */}
              <div className="md:col-span-2">
                <label className="text-[11px] text-slate-500 mb-1 block">ค้นหา</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-2 flex items-center text-slate-400">
                    <Icon.Search />
                  </span>
                  <input
                    className="w-full rounded-lg border px-9 py-2 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200"
                    placeholder="ชื่อเรื่อง / ฟิลด์ / ค่าเดิม-ค่าใหม่ / ผู้แก้ไข"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </div>

              {/* from */}
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">ตั้งแต่</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-2 flex items-center text-slate-400">
                    <Icon.Calendar />
                  </span>
                  <input
                    type="date"
                    className="w-full rounded-lg border px-8 py-2 text-sm focus:ring-2 focus:ring-blue-200"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
              </div>

              {/* to */}
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">ถึง</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-2 flex items-center text-slate-400">
                    <Icon.Calendar />
                  </span>
                  <input
                    type="date"
                    className="w-full rounded-lg border px-8 py-2 text-sm focus:ring-2 focus:ring-blue-200"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="md:self-end">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 transition"
                >
                  ค้นหา
                </button>
              </div>
            </form>
          </div>

          {/* List */}
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b bg-gray-50 px-4 py-2 text-xs text-gray-500">
              เหตุการณ์ล่าสุด
            </div>

            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : rows.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                  <Icon.Search />
                </div>
                <div className="text-sm text-gray-600">ไม่พบเหตุการณ์ที่ตรงกับเงื่อนไข</div>
                <div className="text-xs text-gray-400 mt-1">ลองลบตัวกรองหรือกรอกคำค้นอื่น</div>
              </div>
            ) : (
              rows.map((r) => (
                <details key={r.id} className="px-4 py-4 border-b last:border-0 group">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div className="text-xs text-gray-500">
                        {formatDT(r.when)} • {r.user}
                      </div>
                      {r.status_after ? (
                        <span className="self-start md:self-auto text-[10px] px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {r.status_after}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-0.5 font-medium text-slate-900">
                      <a href={`/staff/reviews/${r.pub_id}`} className="underline decoration-dotted underline-offset-2 hover:text-blue-700">
                        {r.pub_name || `pub#${r.pub_id}`}
                      </a>
                    </div>

                    <div className="mt-1.5">
                      <FieldChip name={r.field} />
                      <Diff oldV={r.old_value} newV={r.new_value} />
                    </div>
                  </summary>

                  {/* extra info */}
                  <div className="mt-3 text-xs text-gray-600 grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div><span className="text-gray-400">pub_id:</span> {r.pub_id}</div>
                    <div className="col-span-1 md:col-span-3"><span className="text-gray-400">เวลา:</span> {formatDT(r.when)}</div>
                  </div>
                </details>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}