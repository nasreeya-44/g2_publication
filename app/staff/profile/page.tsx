// app/staff/profile/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import StaffSideRail from "@/components/StaffSideRail";

/* ========== Types ========== */
type Role = "ADMIN" | "STAFF" | "PROFESSOR";
type Status = "ACTIVE" | "SUSPENDED";

type Me = {
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  // department ถูกตัดออกจากการแก้ไขแล้ว (เก็บไว้ใน type ได้ แต่ไม่ใช้ในฟอร์ม)
  department?: string | null;
  role: Role;
  status: Status;
  profile_image?: string | null;
};

/* ========== Helpers ========== */
async function readPayload(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text().catch(() => "");
  return { ok: false, message: `API non-JSON (${res.status}): ${text.slice(0, 180)}` };
}
const isEmail = (s?: string | null): boolean =>
  !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/* ====== Small UI: แสดงค่าเดิมเมื่อมีการแก้ไข ====== */
function OldValue({ oldValue, current }: { oldValue?: string | null; current: string }) {
  const ov = (oldValue ?? "").trim();
  const cv = (current ?? "").trim();
  if (!ov || ov === cv) return null;
  return (
    <div className="text-[11px] text-gray-400 mt-1">
      เดิม: <span className="italic">{ov}</span>
    </div>
  );
}

/* ========== Reusable UI ========== */
function Avatar({ url, size = 96 }: { url?: string | null; size?: number }) {
  const s = `${size}px`;
  return (
    <div className="rounded-full bg-gray-200 overflow-hidden flex items-center justify-center" style={{ width: s, height: s }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="avatar" className="w-full h-full object-cover" />
      ) : (
        <svg viewBox="0 0 24 24" width={Math.floor(size * 0.6)} height={Math.floor(size * 0.6)} className="text-gray-400">
          <path fill="currentColor" d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5.33 0-8 2.667-8 6v1h16v-1c0-3.333-2.67-6-8-6z" />
        </svg>
      )}
    </div>
  );
}
function LabeledInput(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string | null;
}) {
  const { label, value, onChange, type = "text", placeholder, disabled, error } = props;
  return (
    <div>
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""
        } ${error ? "border-red-300 focus:ring-red-400" : ""}`}
      />
      {!!error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}
function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-white font-medium transition ${
        disabled ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
      }`}
    >
      {children}
    </button>
  );
}
function OutlineButton({ children, onClick, tone = "slate" }: { children: React.ReactNode; onClick?: () => void; tone?: "slate" | "red" }) {
  const cls = tone === "red" ? "border-red-300 text-red-700 hover:bg-red-50" : "border-gray-300 text-slate-700 hover:bg-gray-50";
  return (
    <button onClick={onClick} className={`px-3 py-2 rounded-lg border ${cls}`}>
      {children}
    </button>
  );
}

/* ========== Page ========== */
export default function StaffProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  // form state (ไม่มี department แล้ว)
  const [first_name, setFirstName] = useState("");
  const [last_name, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [profile_image, setProfileImage] = useState<string | null>(null);

  /* ===== Change Password (state) ===== */
const [pwOpen, setPwOpen] = useState(false);
const [curPw, setCurPw] = useState("");
const [newPw, setNewPw] = useState("");
const [newPw2, setNewPw2] = useState("");

const [pwErrCur, setPwErrCur] = useState<string | null>(null);
const [pwErrNew, setPwErrNew] = useState<string | null>(null);
const [pwErrNew2, setPwErrNew2] = useState<string | null>(null);
const [pwSaving, setPwSaving] = useState(false);

/* ตรวจฟิลด์รหัสผ่าน */
function validatePwFields() {
  let ok = true;
  setPwErrCur(null); setPwErrNew(null); setPwErrNew2(null);

  if (!curPw) { setPwErrCur("กรุณากรอกรหัสผ่านเดิม"); ok = false; }
  if (!newPw || newPw.length < 8) { setPwErrNew("รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร"); ok = false; }
  if (newPw && curPw && newPw === curPw) { setPwErrNew("รหัสผ่านใหม่ต้องไม่เหมือนรหัสผ่านเดิม"); ok = false; }
  if (newPw2 !== newPw) { setPwErrNew2("ยืนยันรหัสผ่านใหม่ไม่ตรงกัน"); ok = false; }

  return ok;
}

/* ส่งเปลี่ยนรหัสผ่าน */
async function submitChangePassword() {
  if (!validatePwFields()) return;
  setPwSaving(true);
  try {
    const res = await fetch("/api/staff/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: curPw, new_password: newPw }),
    });
    const p = await readPayload(res);
    if (!res.ok || p?.ok === false) throw new Error(p?.message || "เปลี่ยนรหัสผ่านล้มเหลว");

    // เคลียร์ฟิลด์และปิด modal
    setCurPw(""); setNewPw(""); setNewPw2("");
    setPwOpen(false);
    alert("เปลี่ยนรหัสผ่านเรียบร้อย");
  } catch (e: any) {
    setPwErrCur(e?.message || "รหัสผ่านเดิมไม่ถูกต้อง");
  } finally {
    setPwSaving(false);
  }
}

  // snapshot ค่าเดิม
  const [orig, setOrig] = useState<Partial<Me> | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  /* ===== Load Me ===== */
  async function loadMe() {
    setLoading(true);
    setError(null);
    try {
      let m: Me | null = null;

      // ใช้ข้อมูลเต็มจาก endpoint ใหม่ (ไม่ยุ่ง /api/staff/me เดิม)
      try {
        const r = await fetch("/api/staff/me/full", { cache: "no-store" });
        const p = await readPayload(r);
        if (r.ok && p?.data) m = p.data as Me;
      } catch {
        /* ignore */
      }

      // fallback: /api/me (โครงสร้างอาจไม่ครบทุกฟิลด์)
      if (!m) {
        const r = await fetch("/api/me", { cache: "no-store" });
        const p = await readPayload(r);
        if (r.ok) {
          const u = (p?.data || p?.user || p) as any;
          if (u?.user_id) m = u;
        }
      }

      if (!m) throw new Error("โหลดโปรไฟล์ล้มเหลว");

      // เติมค่าจาก DB ลงช่อง (prefill)
      setMe(m);
      setFirstName(m.first_name || "");
      setLastName(m.last_name || "");
      setUsername(m.username || "");
      setEmail(m.email || "");
      setPhone(m.phone || "");
      setPosition(m.position || "");
      setProfileImage(m.profile_image || null);

      // snapshot ค่าเดิม
      setOrig({
        first_name: m.first_name || "",
        last_name: m.last_name || "",
        username: m.username || "",
        email: m.email || "",
        phone: m.phone || "",
        position: m.position || "",
        profile_image: m.profile_image || null,
      });
    } catch (e: any) {
      setError(e?.message || "โหลดโปรไฟล์ล้มเหลว");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadMe();
  }, []);

  /* ===== Upload Avatar ===== */
  async function uploadAvatar(file: File) {
    if (!file.type.startsWith("image/")) throw new Error("กรุณาเลือกไฟล์รูปภาพ");
    if (file.size > 5 * 1024 * 1024) throw new Error("ไฟล์ใหญ่เกิน 5MB");

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/staff/profile/avatar", { method: "POST", body: fd, cache: "no-store" });
    const payload = await readPayload(res);
    if (!res.ok || payload?.ok === false) throw new Error(payload?.message || "upload failed");

    const url = payload.publicUrl as string;
    setProfileImage(url);
    setMe((prev) => (prev ? { ...prev, profile_image: url } : prev));
  }

  /* ===== Save Profile ===== */
  async function saveProfile() {
    if (!me?.user_id) return;
    if (email && !isEmail(email)) {
      alert("รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        username: username || null,
        first_name: first_name || null,
        last_name: last_name || null,
        email: email || null,
        phone: phone || null,
        position: position || null,
        profile_image: profile_image || null,
        // ไม่มี department แล้ว
      };
      const res = await fetch("/api/staff/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const p = await readPayload(res);
      if (!res.ok || p?.ok === false) throw new Error(p?.message || "save failed");

      alert("บันทึกโปรไฟล์แล้ว");

      // อัปเดต snapshot เป็นค่าล่าสุด
      setOrig({
        first_name,
        last_name,
        username,
        email,
        phone,
        position,
        profile_image,
      });
    } catch (e: any) {
      alert(e?.message || "บันทึกโปรไฟล์ล้มเหลว");
    } finally {
      setSaving(false);
    }
  }

  /* ===== UI ===== */
  return (
    <div className="min-h-screen bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 relative">
        <StaffSideRail />
        <main className="md:ml-[80px]">
          <div className="min-h-[70vh] flex items-start justify-center py-4">
            <div className="w-full max-w-3xl space-y-6">
              <div className="text-center">
                <h1 className="text-[20px] font-semibold text-slate-900">โปรไฟล์ของฉัน</h1>
                {error && <div className="text-sm text-red-600 mt-1">{error}</div>}
              </div>

              {/* Avatar + Role */}
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6">
                {loading ? (
                  <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-24 h-24 rounded-full bg-gray-100" />
                    <div className="h-4 bg-gray-100 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/4" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Avatar url={profile_image} size={96} />
                    <div className="mt-3 text-slate-900 font-medium">
                      {first_name || "-"} {last_name || ""}
                    </div>
                    <div className="text-xs text-gray-500">
                      {me?.role} • {me?.status}
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            await uploadAvatar(f);
                          } catch (err: any) {
                            alert(err?.message || "อัปโหลดล้มเหลว");
                          } finally {
                            if (fileRef.current) fileRef.current.value = "";
                          }
                        }}
                      />
                      <OutlineButton onClick={() => fileRef.current?.click()}>อัปโหลดรูปโปรไฟล์</OutlineButton>
                       <OutlineButton onClick={() => setPwOpen(true)}>
    เปลี่ยนรหัสผ่าน
  </OutlineButton>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile form */}
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6">
                <h2 className="text-sm font-medium text-slate-900 mb-4 text-center">แก้ไขข้อมูลส่วนตัว</h2>

                {loading ? (
                  <div className="animate-pulse grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="h-10 bg-gray-100 rounded-lg" />
                    <div className="h-10 bg-gray-100 rounded-lg" />
                    <div className="h-10 bg-gray-100 rounded-lg col-span-2" />
                    <div className="h-10 bg-gray-100 rounded-lg col-span-2" />
                    <div className="h-10 bg-gray-100 rounded-lg col-span-2" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <LabeledInput label="ชื่อ" value={first_name} onChange={setFirstName} />
                        <OldValue oldValue={orig?.first_name as string} current={first_name} />
                      </div>

                      <div>
                        <LabeledInput label="นามสกุล" value={last_name} onChange={setLastName} />
                        <OldValue oldValue={orig?.last_name as string} current={last_name} />
                      </div>

                      <div>
                        <LabeledInput label="Username" value={username} onChange={setUsername} />
                        <OldValue oldValue={orig?.username as string} current={username} />
                      </div>

                      <div>
                        <LabeledInput
                          label="อีเมล"
                          value={email}
                          onChange={setEmail}
                          placeholder="name@example.com"
                          error={email && !isEmail(email) ? "รูปแบบอีเมลไม่ถูกต้อง" : null}
                        />
                        <OldValue oldValue={orig?.email as string} current={email} />
                      </div>

                      <div>
                        <LabeledInput label="เบอร์โทร" value={phone} onChange={setPhone} />
                        <OldValue oldValue={orig?.phone as string} current={phone} />
                      </div>

                      <div>
                        <LabeledInput label="ตำแหน่ง" value={position} onChange={setPosition} />
                        <OldValue oldValue={orig?.position as string} current={position} />
                      </div>
                    </div>

                    <div className="mt-6 flex justify-center">
                      <PrimaryButton onClick={saveProfile} disabled={saving || loading}>
                        {saving ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
                      </PrimaryButton>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* ===== Modal: เปลี่ยนรหัสผ่าน ===== */}
{pwOpen && (
  <>
    <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setPwOpen(false)} />
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-blue-700 to-blue-500 text-white flex items-center justify-between">
          <div className="text-base font-semibold">เปลี่ยนรหัสผ่าน</div>
          <button onClick={() => setPwOpen(false)} className="text-white hover:bg-white/20 rounded-lg p-1.5">✕</button>
        </div>

        <div className="p-5 space-y-3">
          <LabeledInput
            label="รหัสผ่านเดิม"
            value={curPw}
            onChange={(v) => { setCurPw(v); setPwErrCur(null); }}
            type="password"
            error={pwErrCur}
          />
          <LabeledInput
            label="รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"
            value={newPw}
            onChange={(v) => { setNewPw(v); setPwErrNew(null); }}
            type="password"
            error={pwErrNew}
          />
          <LabeledInput
            label="ยืนยันรหัสผ่านใหม่"
            value={newPw2}
            onChange={(v) => { setNewPw2(v); setPwErrNew2(null); }}
            type="password"
            error={pwErrNew2}
          />

          <div className="flex justify-end gap-2 pt-1">
            <OutlineButton onClick={() => setPwOpen(false)}>ยกเลิก</OutlineButton>
            <PrimaryButton onClick={submitChangePassword} disabled={pwSaving}>
              {pwSaving ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  </>
)}
        </main>
      </div>
    </div>
  );
}