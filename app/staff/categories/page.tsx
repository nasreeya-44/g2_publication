// app/staff/categories/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import StaffSideRail from "@/components/StaffSideRail";

/* ---------------- icons ---------------- */
const Icon = {
  Pencil: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
    </svg>
  ),
  Trash: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  Search: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
};

/* ---------------- types ---------------- */
type Row = {
  category_id: number;
  category_name: string;
  status: "ACTIVE" | "INACTIVE" | string;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
};

function StatusChip({
  status,
  onToggle,
  disabled,
}: {
  status: Row["status"];
  onToggle?: () => void;
  disabled?: boolean;
}) {
  const active = (status || "").toUpperCase() === "ACTIVE";
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition";
  const cls = active
    ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
    : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`${base} ${cls} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      title="คลิกเพื่อสลับสถานะ"
      aria-label="toggle status"
    >
      {active ? "เปิดใช้งาน" : "ไม่ได้ใช้งาน"}
    </button>
  );
}

/* ---------------- page ---------------- */
export default function StaffCategoriesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null); // กำลังอัปเดตสถานะของแถวไหน

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      const res = await fetch(`/api/staff/categories?${p}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "load failed");
      setRows(j.data || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function addCategory() {
    const name = prompt("ระบุชื่อหมวดหมู่ใหม่");
    if (!name?.trim()) return;
    const res = await fetch("/api/staff/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const j = await res.json();
    if (!res.ok) return alert(j?.message || "เพิ่มไม่สำเร็จ");
    load();
  }

  async function editCategory(r: Row) {
    const name = prompt("แก้ไขชื่อหมวดหมู่", r.category_name);
    if (!name?.trim()) return;
    const res = await fetch(`/api/staff/categories/${r.category_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_name: name.trim() }),
    });
    const j = await res.json();
    if (!res.ok) return alert(j?.message || "บันทึกไม่สำเร็จ");
    load();
  }

  async function updateStatus(r: Row) {
    const next = (r.status || "").toUpperCase() === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setSavingId(r.category_id);
    try {
      const res = await fetch(`/api/staff/categories/${r.category_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "อัปเดตสถานะไม่สำเร็จ");
      // update แถวใน state ให้ไวขึ้น (ไม่ต้อง reload ทั้งหมดก็ได้)
      setRows(prev =>
        prev.map(x => (x.category_id === r.category_id ? { ...x, status: next } : x))
      );
    } catch (e: any) {
      alert(e?.message || "อัปเดตสถานะไม่สำเร็จ");
    } finally {
      setSavingId(null);
    }
  }

  async function removeCategory(r: Row) {
    if (!confirm(`ลบหมวดหมู่ “${r.category_name}” ?`)) return;
    const res = await fetch(`/api/staff/categories/${r.category_id}`, { method: "DELETE" });
    const j = await res.json();
    if (!res.ok) return alert(j?.message || "ลบไม่สำเร็จ");
    load();
  }

  const hasCreatedBy = useMemo(() => rows.some(x => x.created_by != null), [rows]);

  return (
    <div className="min-h-screen bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 relative">
        <StaffSideRail />

        <main className="md:ml-[80px]">
          {/* Topbar */}
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-sm font-semibold text-gray-800">จัดการหมวดหมู่ผลงานตีพิมพ์</h1>
            <button
              onClick={addCategory}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow-sm hover:bg-blue-700"
            >
              + เพิ่มหมวดหมู่
            </button>
          </div>

          {/* Search */}
          <div className="mb-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <form
              onSubmit={(e) => { e.preventDefault(); load(); }}
              className="flex items-center gap-3"
            >
              <div className="relative w-full max-w-md">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Icon.Search />
                </span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ค้นหาหมวดหมู่..."
                  className="w-full rounded-full border border-gray-300 px-10 py-2 text-sm placeholder:text-gray-400
                             focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg border border-gray-200 bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
              >
                ค้นหา
              </button>
            </form>
          </div>

          {/* List */}
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            {/* Header */}
            <div className="grid grid-cols-12 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
              <div className="col-span-5">ชื่อหมวดหมู่</div>
              <div className="col-span-2">สถานะ</div>
              {hasCreatedBy && <div className="col-span-2">สร้างโดย</div>}
              <div className={hasCreatedBy ? "col-span-2" : "col-span-3"}>วันอัปเดต</div>
              <div className="col-span-1 text-right">จัดการ</div>
            </div>

            {/* Rows */}
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-500">กำลังโหลด...</div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">ยังไม่มีหมวดหมู่</div>
            ) : (
              rows.map((r, i) => (
                <div
                  key={r.category_id}
                  className={`grid grid-cols-12 items-center px-4 py-3 text-sm transition-colors hover:bg-gray-50
                              ${i !== rows.length - 1 ? "border-b border-gray-100" : ""}`}
                >
                  <div className="col-span-5 text-gray-800">{r.category_name}</div>

                  {/* <-- คลิกเพื่อสลับสถานะ --> */}
                  <div className="col-span-2">
                    <StatusChip
                      status={r.status}
                      onToggle={() => updateStatus(r)}
                      disabled={savingId === r.category_id}
                    />
                  </div>

                  {hasCreatedBy && <div className="col-span-2 text-xs text-gray-600">{r.created_by || "-"}</div>}
                  <div className={(hasCreatedBy ? "col-span-2" : "col-span-3") + " text-xs text-gray-600"}>
                    {r.updated_at ? new Date(r.updated_at).toLocaleDateString("th-TH") : "-"}
                  </div>
                  <div className="col-span-1 flex justify-end gap-3">
                    <button
                      onClick={() => editCategory(r)}
                      className="text-blue-600 hover:text-blue-700"
                      title="แก้ไข" aria-label="แก้ไข"
                    >
                      <Icon.Pencil />
                    </button>
                    <button
                      onClick={() => removeCategory(r)}
                      className="text-rose-600 hover:text-rose-700"
                      title="ลบ" aria-label="ลบ"
                    >
                      <Icon.Trash />
                    </button>
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