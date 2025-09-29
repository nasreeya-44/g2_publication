// app/staff/reports/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StaffSideRail from "@/components/StaffSideRail";

/* ------------ types ------------- */
type Totals = {
  all: number;
  published: number;
  under_review: number;
  needs_revision: number;
  with_students: number;
};
type YearPoint = { year: number; count: number };
type TopAuthor = { name: string; published: number; under_review: number; total: number };

type ReportResponse = {
  ok: boolean;
  data: {
    totals: Totals;
    byYear: YearPoint[];
    topAuthors: TopAuthor[];
  };
  message?: string;
};

/* ------------ helpers ------------- */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 ${className}`}>{children}</div>;
}
function KPICell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default function StaffReportsPage() {
  // filters
  const thisYear = new Date().getFullYear();
  const [fromY, setFromY] = useState<number>(thisYear - 2);
  const [toY, setToY] = useState<number>(thisYear);
  const [levels, setLevels] = useState<string[]>([]); // NATIONAL/INTERNATIONAL
  const [statuses, setStatuses] = useState<string[]>(["under_review", "needs_revision", "published"]);
  const [hasPdf, setHasPdf] = useState<"any" | "true" | "false">("any");
  const [author, setAuthor] = useState<string>("");
  const [onlyStudentInvolved, setOnlyStudentInvolved] = useState(false);

  // 👇 ตัวกรองใหม่
  const [ptype, setPtype] = useState<"" | "JOURNAL" | "CONFERENCE" | "BOOK">("");
  const [catsText, setCatsText] = useState<string>(""); // ใส่ Category หลายอันคั่นด้วย , (ชื่อ category_name)

  // data
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [byYear, setByYear] = useState<YearPoint[]>([]);
  const [topAuthors, setTopAuthors] = useState<TopAuthor[]>([]);
  const [fileName, setFileName] = useState(`publication-report-${fromY}-${toY}`);

  const maxCount = useMemo(() => Math.max(1, ...byYear.map((x) => x.count)), [byYear]);

  // 👉 รวม query ปัจจุบัน (reuse ทั้งโหลดกราฟและลิงก์ส่งออก)
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("year_from", String(fromY));
    p.set("year_to", String(toY));
    levels.forEach((l) => p.append("level", l));
    statuses.forEach((s) => p.append("status", s));
    if (hasPdf !== "any") p.set("has_pdf", hasPdf);
    if (author.trim()) p.set("author", author.trim());
    if (onlyStudentInvolved) p.set("only_student", "1");

    // แนบพารามิเตอร์ใหม่
    if (ptype) p.set("type", ptype);
    catsText
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((c) => p.append("cat", c));

    return p;
  }, [fromY, toY, levels, statuses, hasPdf, author, onlyStudentInvolved, ptype, catsText]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/reports?${queryParams.toString()}`, { cache: "no-store" });
      const j: ReportResponse = await res.json();
      if (!res.ok || !j.ok) throw new Error(j?.message || "load failed");

      setTotals(j.data.totals);
      setByYear(j.data.byYear);
      setTopAuthors(j.data.topAuthors);
      setFileName(`publication-report-${fromY}-${toY}`);
    } catch (e: any) {
      alert(e?.message || "โหลดรายงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [queryParams, fromY, toY]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleValue<T extends string>(list: T[], v: T, set: (x: T[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  // 👉 ลิงก์ส่งออก (จะอัปเดตอัตโนมัติตามตัวกรอง)
  const hrefCSV  = useMemo(() => `/api/staff/reports/export/csv?${queryParams.toString()}`,  [queryParams]);
  const hrefXLSX = useMemo(() => `/api/staff/reports/export/xlsx?${queryParams.toString()}`, [queryParams]);
  const hrefPDF  = useMemo(() => `/api/staff/reports/export/pdf?${queryParams.toString()}`,  [queryParams]);

  return (
    <div className="min-h-screen bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 relative">
        <StaffSideRail />

        <main className="md:ml-[80px] space-y-5">
          {/* Filters */}
          <Card className="p-4">
            <div className="text-sm font-semibold text-slate-900 mb-3">ตัวกรองรายงาน</div>

            <div className="grid gap-3 md:grid-cols-5">
              {/* ช่วงปี */}
              <div className="col-span-2 flex gap-2">
                <input
                  type="number"
                  value={fromY}
                  onChange={(e) => setFromY(Number(e.target.value || thisYear))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="ปีเริ่ม"
                />
                <input
                  type="number"
                  value={toY}
                  onChange={(e) => setToY(Number(e.target.value || thisYear))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="ปีสิ้นสุด"
                />
              </div>

              {/* ระดับ */}
              <div className="col-span-1">
                <div className="text-xs text-gray-500 mb-1">ระดับ</div>
                <div className="flex flex-wrap gap-2">
                  {["NATIONAL", "INTERNATIONAL"].map((lv) => (
                    <button
                      key={lv}
                      onClick={() => toggleValue(levels, lv, setLevels)}
                      className={`px-3 py-1.5 rounded-lg text-xs border ${
                        levels.includes(lv) ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-700"
                      }`}
                    >
                      {lv}
                    </button>
                  ))}
                </div>
              </div>

              {/* สถานะ */}
              <div className="col-span-2">
                <div className="text-xs text-gray-500 mb-1">สถานะ</div>
                <div className="flex flex-wrap gap-2">
                  {["draft", "under_review", "needs_revision", "published", "archived"].map((st) => (
                    <button
                      key={st}
                      onClick={() => toggleValue(statuses, st, setStatuses)}
                      className={`px-3 py-1.5 rounded-lg text-xs border ${
                        statuses.includes(st) ? "bg-slate-900 text-white border-slate-900" : "bg-gray-50 text-gray-700"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* แถวใหม่: ประเภท + หมวดหมู่ */}
            <div className="mt-3 grid gap-3 md:grid-cols-5">
              {/* ประเภท */}
              <div>
                <div className="text-xs text-gray-500 mb-1">ประเภท</div>
                <select
                  value={ptype}
                  onChange={(e) => setPtype(e.target.value as any)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">ทั้งหมด</option>
                  <option value="JOURNAL">JOURNAL</option>
                  <option value="CONFERENCE">CONFERENCE</option>
                  <option value="BOOK">BOOK</option>
                </select>
              </div>

              {/* หมวดหมู่ */}
              <div className="md:col-span-2">
                <div className="text-xs text-gray-500 mb-1">หมวดหมู่ (คั่นด้วย ,)</div>
                <input
                  value={catsText}
                  onChange={(e) => setCatsText(e.target.value)}
                  placeholder="เช่น Data Science, Software Engineering"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
                <div className="text-[11px] text-gray-400 mt-1">
                  ระบบจะดึงผลงานที่อยู่ใน “อย่างน้อยหนึ่ง” ของหมวดหมู่ที่ระบุ
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-5">
              {/* ผู้แต่ง */}
              <div className="col-span-2">
                <div className="text-xs text-gray-500 mb-1">อาจารย์ / ผู้แต่ง</div>
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="พิมพ์ชื่อบางส่วน เช่น Somchai"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              {/* has pdf */}
              <div>
                <div className="text-xs text-gray-500 mb-1">ไฟล์ PDF</div>
                <select
                  value={hasPdf}
                  onChange={(e) => setHasPdf(e.target.value as any)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="any">ทั้งหมด</option>
                  <option value="true">มีไฟล์</option>
                  <option value="false">ไม่มีไฟล์</option>
                </select>
              </div>

              {/* only student involved */}
              <div className="flex items-end gap-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={onlyStudentInvolved}
                    onChange={() => setOnlyStudentInvolved((v) => !v)}
                  />
                  มีนักศึกษาเป็นผู้ร่วม
                </label>
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={load}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? "กำลังดึงข้อมูล…" : "สั่งดึงรายงาน"}
                </button>
                <button
                  onClick={() => {
                    setLevels([]);
                    setStatuses(["under_review", "needs_revision", "published"]);
                    setHasPdf("any");
                    setAuthor("");
                    setOnlyStudentInvolved(false);
                    setPtype("");
                    setCatsText("");
                    setFromY(thisYear - 2);
                    setToY(thisYear);
                  }}
                  className="rounded-lg border px-4 py-2 text-sm bg-gray-50"
                >
                  ล้างตัวกรอง
                </button>
              </div>
            </div>
          </Card>

          {/* KPI */}
          <Card>
            <div className="grid md:grid-cols-4">
              <KPICell label="ผลงานทั้งหมด" value={totals?.all ?? 0} />
              <KPICell label="เผยแพร่แล้ว" value={totals?.published ?? 0} />
              <KPICell
                label="อยู่ระหว่างการตรวจสอบ"
                value={(totals?.under_review ?? 0) + (totals?.needs_revision ?? 0)}
              />
              <KPICell label="มีนักศึกษาเป็นผู้ร่วม" value={totals?.with_students ?? 0} />
            </div>
          </Card>

          {/* Chart + Top authors */}
          <div className="grid gap-5 md:grid-cols-2">
            <Card className="p-4">
              <div className="text-sm font-semibold text-slate-900 mb-2">กราฟจำนวนผลงานตามปี</div>
              {byYear.length === 0 ? (
                <div className="p-8 text-sm text-gray-500">ไม่มีข้อมูล</div>
              ) : (
                <div className="h-56 flex items-end gap-3 px-2">
                  {byYear.map((pt) => (
                    <div key={pt.year} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-8 bg-blue-500/80 rounded-t"
                        style={{ height: `${(pt.count / maxCount) * 180 + 8}px` }}
                        title={`${pt.year}: ${pt.count}`}
                      />
                      <div className="text-xs text-gray-600 mt-1">{pt.year}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="text-sm font-semibold text-slate-900 mb-2">ตัวอย่างตารางสรุป (Top 5)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="px-3 py-2 text-left">อาจารย์</th>
                      <th className="px-3 py-2 text-right">เผยแพร่แล้ว</th>
                      <th className="px-3 py-2 text-right">อยู่ระหว่างตรวจ</th>
                      <th className="px-3 py-2 text-right">ทั้งหมด</th>
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
                          <td className="px-3 py-2 text-right">{a.published}</td>
                          <td className="px-3 py-2 text-right">{a.under_review}</td>
                          <td className="px-3 py-2 text-right font-medium">{a.total}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Export */}
          <Card className="p-4">
            <div className="text-sm font-semibold text-slate-900 mb-2">ส่งออก</div>
            <div className="grid md:grid-cols-3 gap-3 items-center">
              <input
                className="rounded-lg border px-3 py-2 text-sm"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
              />
              <div className="flex gap-2">
                <a
                  href={hrefXLSX}
                  download={`${fileName || "publication-report"}.xlsx`}
                  className="rounded-lg px-4 py-2 text-sm bg-gray-100 border hover:bg-gray-200 inline-flex items-center justify-center"
                >
                  Excel (.xlsx)
                </a>
                <a
                  href={hrefCSV}
                  download={`${fileName || "publication-report"}.csv`}
                  className="rounded-lg px-4 py-2 text-sm bg-gray-100 border hover:bg-gray-200 inline-flex items-center justify-center"
                >
                  CSV (UTF-8)
                </a>
              </div>
              // ตัวอย่างปุ่มบนหน้า /staff/reports (หรือที่ไหนก็ได้)

            </div>
            <div className="mt-2 text-xs text-gray-500">
              * ลิงก์จะยิงไปยัง <code>/api/staff/reports/export.*</code> พร้อม query ปัจจุบันโดยอัตโนมัติ
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}