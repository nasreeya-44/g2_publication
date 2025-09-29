// app/staff/search/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StaffSideRail from "@/components/StaffSideRail";

type Item = {
  pub_id: number;
  pub_name: string | null;
  year: number | null;
  type: string | null;   // JOURNAL / CONFERENCE / BOOK
  level: string | null;  // NATIONAL / INTERNATIONAL
  has_pdf: boolean | null;
  updated_at: string | null;
  authors: string[];     // ชื่อผู้แต่งแบบย่อ
  categories: string[];  // ชื่อหมวดหมู่
};

type Facet = { name: string; count: number };

type SearchResponse = {
  ok: boolean;
  data: {
    items: Item[];
    total: number;
    page: number;
    page_size: number;
    facets: { categories: Facet[] };
  };
  message?: string;
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-[2px] text-[11px]">
      {children}
    </span>
  );
}

export default function StaffSearchPage() {
  // ----------------- filters (UI state) -----------------
  const thisYear = new Date().getFullYear();

  const [scope, setScope] = useState<"all" | "title" | "author">("all");
  const [q, setQ] = useState("");
  const [yearFrom, setYearFrom] = useState<number | "">("");
  const [yearTo, setYearTo] = useState<number | "">("");
  const [ptype, setPtype] = useState<string>("");     // JOURNAL/CONFERENCE/BOOK/""(ทั้งหมด)
  const [levels, setLevels] = useState<string[]>([]); // NATIONAL/INTERNATIONAL
  const [hasPdf, setHasPdf] = useState<boolean | "any">("any");
  const [onlyStudent, setOnlyStudent] = useState(false);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  // ----------------- paging -----------------
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // ----------------- data -----------------
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<{ categories: Facet[] }>({ categories: [] });

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total]
  );

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("page_size", String(pageSize));
    if (q.trim()) p.set("q", q.trim());
    if (scope !== "all") p.set("scope", scope);
    if (yearFrom !== "") p.set("year_from", String(yearFrom));
    if (yearTo !== "") p.set("year_to", String(yearTo));
    if (ptype) p.set("type", ptype);
    levels.forEach((lv) => p.append("level", lv));
    if (hasPdf !== "any") p.set("has_pdf", hasPdf ? "true" : "false");
    if (onlyStudent) p.set("only_student", "1");
    selectedCats.forEach((c) => p.append("cat", c));
    return p;
  }, [page, q, scope, yearFrom, yearTo, ptype, levels, hasPdf, onlyStudent, selectedCats]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = buildQuery();
      const res = await fetch(`/api/staff/search?${p.toString()}`, { cache: "no-store" });
      const j: SearchResponse = await res.json();
      if (!res.ok || !j.ok) throw new Error(j?.message || "load failed");
      setItems(j.data.items);
      setTotal(j.data.total);
      setFacets(j.data.facets);
    } catch (e: any) {
      alert(e?.message || "ไม่สามารถดึงผลค้นหา");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => { load(); }, [load]);

  // -------------- UI --------------
  function toggle<T extends string>(arr: T[], val: T, set: (x: T[]) => void) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  return (
    <div className="min-h-screen bg-[#0B2A6B]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-5">
        {/* --- top filter bar --- */}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow p-4">
          <div className="grid gap-3 md:grid-cols-12 items-center">
            {/* scope */}
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">ค้นหาจาก</label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
              >
                <option value="all">ทั้งหมด</option>
                <option value="title">ชื่อเรื่อง</option>
                <option value="author">ผู้วิจัย/ผู้แต่ง</option>
              </select>
            </div>

            {/* keyword */}
            <div className="md:col-span-5">
              <label className="text-xs text-gray-500 mb-1 block">คำค้น</label>
              <div className="flex gap-2">
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="ค้นหาทั้งระบบ เช่น ชื่อเรื่อง, ผู้วิจัย, คำสำคัญ…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <button
                  onClick={() => { setPage(1); load(); }}
                  className="rounded-lg bg-blue-600 text-white px-4 text-sm"
                >
                  ค้นหา
                </button>
              </div>
            </div>

            {/* ปีเริ่ม-สิ้นสุด */}
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">ปีเริ่มต้น</label>
              <input
                type="number"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value ? Number(e.target.value) : "")}
                placeholder="ค.ศ."
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">ปีสิ้นสุด</label>
              <input
                type="number"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value ? Number(e.target.value) : "")}
                placeholder="ค.ศ."
              />
            </div>

            {/* รีเซ็ต */}
            <div className="md:col-span-1 flex items-end">
              <button
                onClick={() => {
                  setScope("all"); setQ("");
                  setYearFrom(""); setYearTo("");
                  setPtype(""); setLevels([]);
                  setHasPdf("any"); setOnlyStudent(false);
                  setSelectedCats([]); setPage(1);
                  load();
                }}
                className="w-full rounded-lg border px-4 py-2 text-sm bg-gray-50"
              >
                รีเซ็ต
              </button>
            </div>
          </div>

          {/* row 2 */}
          <div className="grid gap-3 md:grid-cols-12 items-end mt-3">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">ประเภท</label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={ptype}
                onChange={(e) => setPtype(e.target.value)}
              >
                <option value="">ทั้งหมด</option>
                <option value="JOURNAL">JOURNAL</option>
                <option value="CONFERENCE">CONFERENCE</option>
                <option value="BOOK">BOOK</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-gray-500 mb-1 block">ระดับ</label>
              <div className="flex gap-2">
                {["NATIONAL", "INTERNATIONAL"].map((lv) => (
                  <button
                    key={lv}
                    onClick={() => toggle(levels, lv, setLevels)}
                    className={`px-3 py-2 rounded-lg text-xs border ${
                      levels.includes(lv) ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50"
                    }`}
                  >
                    {lv}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-gray-500 mb-1 block">ไฟล์ PDF</label>
              <div className="flex gap-3 items-center">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hasPdf === true}
                    onChange={(e) => setHasPdf(e.target.checked ? true : "any")}
                  />
                  มีไฟล์ PDF
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hasPdf === false}
                    onChange={(e) => setHasPdf(e.target.checked ? false : "any")}
                  />
                  ไม่มีไฟล์ PDF
                </label>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">นักศึกษาร่วม</label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={onlyStudent}
                  onChange={() => setOnlyStudent((v) => !v)}
                />
                มีนักศึกษาร่วม
              </label>
            </div>
          </div>
        </div>

        {/* --- content area --- */}
        <div className="grid md:grid-cols-12 gap-5 mt-6">
          {/* facets - categories */}
          <aside className="md:col-span-3">
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="text-sm font-semibold mb-2">หมวดหมู่</div>
              <div className="space-y-2">
                {facets.categories.length === 0 ? (
                  <div className="text-xs text-gray-500">ไม่มีข้อมูล</div>
                ) : (
                  facets.categories.map((f) => (
                    <label key={f.name} className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedCats.includes(f.name)}
                          onChange={() =>
                            toggle(selectedCats, f.name, setSelectedCats)
                          }
                        />
                        {f.name}
                      </span>
                      <span className="text-xs text-gray-500">{f.count}</span>
                    </label>
                  ))
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => { setSelectedCats([]); setPage(1); load(); }}
                  className="rounded-lg border px-3 py-2 text-sm bg-gray-50"
                >
                  ล้างหมวดหมู่
                </button>
                <button
                  onClick={() => { setPage(1); load(); }}
                  className="rounded-lg bg-blue-600 text-white px-3 py-2 text-sm"
                >
                  ค้นหา
                </button>
              </div>
            </div>
          </aside>

          {/* results */}
          <section className="md:col-span-9">
            <div className="bg-white rounded-2xl shadow divide-y">
              <div className="px-5 py-3 text-sm text-gray-600">
                แสดง {items.length ? (page - 1) * pageSize + 1 : 0} –{" "}
                {(page - 1) * pageSize + items.length} จาก {total} รายการ
              </div>

              {loading ? (
                <div className="px-5 py-10 text-center text-sm text-gray-500">กำลังโหลด…</div>
              ) : items.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-gray-500">ไม่พบข้อมูล</div>
              ) : (
                items.map((it) => (
                  <div key={it.pub_id} className="px-5 py-4">
                    <div className="text-[18px] font-semibold text-slate-900">
                      {it.pub_name || `pub#${it.pub_id}`}
                    </div>
                    <div className="text-sm text-gray-700 mt-1">
                      {it.authors.join(", ")} • {it.year ?? "-"} •{" "}
                      {it.type ?? "-"} • {it.level ?? "-"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {it.categories.map((c) => (
                        <Chip key={c}>{c}</Chip>
                      ))}
                      {it.has_pdf ? <Chip>PDF</Chip> : null}
                    </div>
                    <div className="mt-3">
                      <a
                        href={`/staff/search/${it.pub_id}`}
                        className="inline-flex items-center rounded-lg bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
                      >
                        ดูรายละเอียด
                      </a>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      อัปเดตล่าสุด:{" "}
                      {it.updated_at
                        ? new Date(it.updated_at).toLocaleString("th-TH")
                        : "-"}
                    </div>
                  </div>
                ))
              )}

              {/* pager */}
              <div className="px-5 py-3 flex items-center gap-2 justify-end">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                >
                  ก่อนหน้า
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                >
                  ถัดไป
                </button>
                <div className="text-xs text-gray-500">
                  หน้า {page} / {totalPages}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}