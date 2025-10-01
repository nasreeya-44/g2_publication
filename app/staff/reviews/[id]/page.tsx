// app/staff/reviews/[id]/page.tsx
"use client";

import { use, useEffect, useRef, useState } from "react";
import StaffSideRail from "@/components/StaffSideRail";

type Detail = {
  id: number;
  title: string;
  type: string;
  level: string;
  year: number | null;
  venue: string | null;
  owner_name: string | null;
  corresponding_email: string | null;
  doi_url: string | null;
  status: string;
  updated_at: string | null;
  authors: Array<{ order: number; name: string; role: string }>;
  history: Array<{ when: string; by: string; action: string }>;
  review_files_count: number;
  abstract?: string | null; // 👈 เพิ่มชนิด
};

// 👇 เพิ่มชนิด/สเตตสำหรับแสดงไฟล์ (อ่านอย่างเดียว)
type ReviewFile = { id?: string; name?: string; url: string; uploaded_at?: string };

export default function StaffReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = use(params);
  const id = Number(idStr);

  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState<"draft" | "approve" | "request" | null>(null);

  // 👇 state สำหรับไฟล์แนบ (อาจารย์อัปโหลด)
  const [files, setFiles] = useState<ReviewFile[]>([]);
  const [filesErr, setFilesErr] = useState<string | null>(null);

  async function load() {
    if (!Number.isFinite(id)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/reviews/${id}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "load failed");
      setD(j.data as Detail);

      // 👇 โหลดรายการไฟล์แนบ (อ่านอย่างเดียว)
      try {
        const rFiles = await fetch(`/api/staff/reviews/${id}/files`, { cache: "no-store" });
        const txt = await rFiles.text();
        const jf = txt ? JSON.parse(txt) : null;
        if (rFiles.ok && Array.isArray(jf?.data)) {
          setFiles(jf.data as ReviewFile[]);
          setFilesErr(null);
        } else {
          setFiles([]);
          setFilesErr(jf?.message ?? "โหลดไฟล์ไม่สำเร็จ");
        }
      } catch {
        setFiles([]);
        setFilesErr("โหลดไฟล์ไม่สำเร็จ");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  // ❗ คงฟังก์ชันเดิมไว้ (ไม่ใช้งานแล้ว) เพื่อไม่กระทบส่วนอื่น
  async function uploadFiles() {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    const r = await fetch(`/api/staff/reviews/${id}/files`, { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) return alert(j?.message || "อัปโหลดไม่สำเร็จ");
    fileRef.current!.value = "";
    load();
  }

  async function doAction(action: "draft" | "approve" | "request") {
    setSaving(action);
    try {
      const res = await fetch(`/api/staff/reviews/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "ดำเนินการไม่สำเร็จ");
      alert("บันทึกแล้ว");
      setNote("");
      load();
    } catch (e: any) {
      alert(e?.message || "ดำเนินการไม่สำเร็จ");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 relative">
        <StaffSideRail />
        <main className="md:ml-[80px]">
          {!Number.isFinite(id) ? (
            <div className="p-8 text-center text-sm text-rose-600">รหัสไม่ถูกต้อง</div>
          ) : loading || !d ? (
            <div className="p-8 text-center text-sm text-gray-500">กำลังโหลด…</div>
          ) : (
            <div className="space-y-5">
              {/* ข้อมูลงาน + ผู้ร่วมวิจัย */}
              <div className="grid md:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5">
                  <div className="text-sm font-semibold mb-3">ข้อมูลงาน</div>
                  <div className="text-base font-medium text-gray-900 mb-2">{d.title}</div>

                  <div className="mb-1 text-xs inline-flex items-center px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                    {d.status === "UNDER_REVIEW" ? "อยู่ระหว่างการตรวจสอบ" : d.status}
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mt-3">
                    <div><span className="text-gray-500">ประเภท: </span>{d.type}</div>
                    <div><span className="text-gray-500">ระดับ: </span>{d.level}</div>
                    <div><span className="text-gray-500">ปีที่ตีพิมพ์: </span>{d.year ?? "-"}</div>
                    <div><span className="text-gray-500">แหล่งตีพิมพ์: </span>{d.venue || "-"}</div>
                    <div><span className="text-gray-500">เจ้าของหลัก: </span>{d.owner_name || "-"}</div>
                    <div><span className="text-gray-500">ผู้ประสานงาน: </span>{d.corresponding_email || "-"}</div>
                    <div className="col-span-2">
                      <span className="text-gray-500">ลิงก์ DOI: </span>
                      {d.doi_url ? (
                        <a className="text-blue-600 underline" href={d.doi_url} target="_blank">{d.doi_url}</a>
                      ) : ("-")}
                    </div>
                  </div>

                  {/* 🔽 บทคัดย่อ */}
                  <div className="mt-5">
                    <div className="text-sm font-semibold text-slate-900 mb-1">บทคัดย่อ</div>
                    {d.abstract ? (
                      <details className="group">
                        <summary className="cursor-pointer text-sm text-blue-700 hover:underline">
                          แสดง/ซ่อน บทคัดย่อ
                        </summary>
                        <div className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
                          {d.abstract}
                        </div>
                      </details>
                    ) : (
                      <div className="text-sm text-gray-500">- ไม่มีบทคัดย่อ -</div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5">
                  <div className="text-sm font-semibold mb-3">ผู้ร่วมวิจัย (ตามลำดับ)</div>
                  <div className="text-sm">
                    <div className="grid grid-cols-12 text-xs text-gray-500 px-2">
                      <div className="col-span-1">#</div>
                      <div className="col-span-8">ชื่อ</div>
                      <div className="col-span-3">บทบาท</div>
                    </div>
                    <div className="mt-1 space-y-1">
                      {d.authors.map((a) => (
                        <div key={a.order} className="grid grid-cols-12 items-center px-2 py-1 rounded hover:bg-gray-50">
                          <div className="col-span-1 text-xs">{a.order}</div>
                          <div className="col-span-8">{a.name}</div>
                          <div className="col-span-3 text-xs uppercase text-gray-600">{a.role}</div>
                        </div>
                      ))}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-3">หมายเหตุ: เรียงตาม author_order</div>
                  </div>
                </div>
              </div>

              {/* การพิจารณา */}
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5">
                <div className="text-sm font-semibold">การพิจารณา</div>
                <div className="mt-3 text-sm text-gray-700">ความคิดเห็น (กรณีส่งคืนให้แก้ไข)</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="กรุณาเหตุผล เช่น รายชื่อผู้ร่วมวิจัยไม่ครบ, พิสูจน์อักษร, ไฟล์ PDF ผิดฉบับ..."
                  className="mt-2 w-full rounded-xl border px-3 py-2 min-h-[120px]"
                />

                {/* 🔁 แก้เฉพาะบล็อกแนบไฟล์: แสดงไฟล์ 'ดูอย่างเดียว' */}
                <div className="mt-4">
                  <div className="text-sm text-gray-700 mb-2">ไฟล์แนบ/สิ่งที่เกี่ยวข้อง</div>

                  {filesErr ? (
                    <div className="text-xs text-rose-600">{filesErr}</div>
                  ) : files.length === 0 ? (
                    <div className="text-sm text-gray-500">ยังไม่มีไฟล์ที่อาจารย์แนบ</div>
                  ) : (
                    <ul className="divide-y rounded-xl border bg-gray-50">
                      {files.map((f, i) => (
                        <li key={f.id ?? i} className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] px-2 py-0.5 rounded-full border bg-white">PDF</span>
                            <span className="text-sm">{f.name ?? `ไฟล์ที่ ${i + 1}`}</span>
                            {f.uploaded_at && (
                              <span className="text-xs text-gray-500">
                                • {new Date(f.uploaded_at).toLocaleString("th-TH")}
                              </span>
                            )}
                          </div>
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 underline"
                          >
                            เปิดดู
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* แสดงตัวเลขรวมตามข้อมูลเดิม (ไม่เปลี่ยนพฤติกรรมเดิม) */}
                  <div className="text-sm text-gray-600 mt-2">ไฟล์ PDF แนบ ({d.review_files_count})</div>
                </div>

                <div className="mt-5 grid md:grid-cols-3 gap-3">
                  <button onClick={() => doAction("request")} disabled={saving !== null}
                          className="rounded-xl bg-rose-600 text-white py-3 hover:bg-rose-700">
                    {saving === "request" ? "กำลังส่งคืน…" : "ส่งคืนเพื่อแก้ไข"}
                  </button>
                  <button onClick={() => doAction("approve")} disabled={saving !== null}
                          className="rounded-xl bg-green-600 text-white py-3 hover:bg-green-700">
                    {saving === "approve" ? "กำลังอนุมัติ…" : "อนุมัติผลงาน"}
                  </button>
                  <button onClick={() => doAction("draft")} disabled={saving !== null}
                          className="rounded-xl bg-slate-800 text-white py-3 hover:bg-slate-900">
                    {saving === "draft" ? "กำลังบันทึก…" : "บันทึกเป็นร่าง"}
                  </button>
                </div>

                <div className="mt-6 text-xs text-gray-600">
                  <div className="font-medium mb-1">ประวัติสถานะล่าสุด</div>
                  <div className="grid md:grid-cols-2 gap-2">
                    {d.history.map((h, i) => (
                      <div key={i} className="rounded-lg border px-3 py-2 bg-gray-50">
                        {new Date(h.when).toLocaleString("th-TH")} • {h.by} • {h.action}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}