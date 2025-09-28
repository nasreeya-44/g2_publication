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
  department?: string | null;
  role: Role;
  status: Status;
  profile_image?: string | null;
};

/* ========== Helpers ========== */
async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const t = await res.text().catch(() => "");
    throw new Error(`API non-JSON (${res.status}): ${t.slice(0, 180)}`);
  }
  return res.json();
}
const isEmail = (s?: string | null) =>
  !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/* ========== Reusable UI ========== */
function Avatar({ url, size = 96 }: { url?: string | null; size?: number }) {
  const s = `${size}px`;
  return (
    <div
      className="rounded-full bg-gray-200 overflow-hidden flex items-center justify-center"
      style={{ width: s, height: s }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="avatar" className="w-full h-full object-cover" />
      ) : (
        <svg
          viewBox="0 0 24 24"
          width={Math.floor(size * 0.6)}
          height={Math.floor(size * 0.6)}
          className="text-gray-400"
        >
          <path
            fill="currentColor"
            d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5.33 0-8 2.667-8 6v1h16v-1c0-3.333-2.67-6-8-6z"
          />
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
  const { label, value, onChange, type = "text", placeholder, disabled, error } =
    props;
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
function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
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
function OutlineButton({
  children,
  onClick,
  tone = "slate",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "slate" | "red";
}) {
  const cls =
    tone === "red"
      ? "border-red-300 text-red-700 hover:bg-red-50"
      : "border-gray-300 text-slate-700 hover:bg-gray-50";
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

  // form state
  const [first_name, setFirstName] = useState("");
  const [last_name, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [profile_image, setProfileImage] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  /* ===== Load Me (เหมือนแอดมิน แต่ใช้ staff endpoints) ===== */
  async function loadMe() {
    setLoading(true);
    setError(null);
    try {
      // ปกติใช้ /api/staff/me
      let m: Me | null = null;
      try {
        const r = await fetch("/api/staff/me", { cache: "no-store" });
        if (r.ok) {
          const j = await safeJson(r);
          const u = j?.user || j?.data || j;
          if (u?.user_id) m = u as Me;
        }
      } catch {
        // ignore
      }
      // fallback: /api/me (กันหลุด)
      if (!m) {
        const r = await fetch("/api/me", { cache: "no-store" });
        if (r.ok) {
          const j = await safeJson(r);
          const u = j?.data || j;
          if (u?.user_id) m = u as Me;
        }
      }
      if (!m) throw new Error("โหลดโปรไฟล์ล้มเหลว");

      setMe(m);
      setFirstName(m.first_name || "");
      setLastName(m.last_name || "");
      setUsername(m.username || "");
      setEmail(m.email || "");
      setPhone(m.phone || "");
      setPosition(m.position || "");
      setDepartment(m.department || "");
      setProfileImage(m.profile_image || null);
    } catch (e: any) {
      setError(e?.message || "โหลดโปรไฟล์ล้มเหลว");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadMe();
  }, []);

  /* ===== Upload Avatar (POST /api/staff/profile/avatar) ===== */
  async function uploadAvatar(file: File) {
    if (!me?.user_id) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/staff/profile/avatar", {
      method: "POST",
      body: fd,
    });
    const json = await safeJson(res);
    if (!res.ok || json?.ok === false) throw new Error(json?.message || "upload failed");
    const url = json.publicUrl as string;
    setProfileImage(url);
    setMe((prev) => (prev ? { ...prev, profile_image: url } : prev));
    alert("อัปเดตรูปโปรไฟล์แล้ว");
  }

  /* ===== Save Profile (PUT /api/staff/profile) ===== */
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
        department: department || null,
        profile_image: profile_image || null,
      };
      const res = await fetch("/api/staff/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await safeJson(res);
      if (!res.ok || json?.ok === false) throw new Error(json?.message || "save failed");
      alert("บันทึกโปรไฟล์แล้ว");
    } catch (e: any) {
      alert(e?.message || "บันทึกโปรไฟล์ล้มเหลว");
    } finally {
      setSaving(false);
    }
  }

  /* ===== Change Password (POST /api/staff/change-password) ===== */
  const [pwOpen, setPwOpen] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwErrCur, setPwErrCur] = useState<string | null>(null);
  const [pwErrNew, setPwErrNew] = useState<string | null>(null);
  const [pwErrNew2, setPwErrNew2] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  function validatePwFields() {
    let ok = true;
    setPwErrCur(null);
    setPwErrNew(null);
    setPwErrNew2(null);
    if (!curPw) {
      setPwErrCur("กรุณากรอกรหัสผ่านเดิม");
      ok = false;
    }
    if (!newPw || newPw.length < 8) {
      setPwErrNew("รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร");
      ok = false;
    }
    if (newPw && curPw && newPw === curPw) {
      setPwErrNew("รหัสผ่านใหม่ต้องไม่เหมือนรหัสผ่านเดิม");
      ok = false;
    }
    if (newPw2 !== newPw) {
      setPwErrNew2("ยืนยันรหัสผ่านใหม่ไม่ตรงกัน");
      ok = false;
    }
    return ok;
  }

  async function submitChangePassword() {
    if (!me?.user_id) return;
    if (!validatePwFields()) return;
    setPwSaving(true);
    try {
      const res = await fetch("/api/staff/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: curPw,
          new_password: newPw,
        }),
      });
      const json = await safeJson(res);
      if (!res.ok || json?.ok === false)
        throw new Error(json?.message || "เปลี่ยนรหัสผ่านล้มเหลว");
      setCurPw("");
      setNewPw("");
      setNewPw2("");
      setPwOpen(false);
      alert("เปลี่ยนรหัสผ่านเรียบร้อย");
    } catch (e: any) {
      setPwErrCur(e?.message || "รหัสผ่านเดิมไม่ถูกต้อง");
    } finally {
      setPwSaving(false);
    }
  }

  /* ===== UI (เหมือนแอดมิน) ===== */
  return (
    <div className="min-h-screen bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 relative">
        <StaffSideRail />
        <main className="md:ml-[80px]">
          <div className="min-h-[70vh] flex items-start justify-center py-4">
            <div className="w-full max-w-3xl space-y-6">
              <div className="text-center">
                <h1 className="text-[20px] font-semibold text-slate-900">
                  โปรไฟล์ของฉัน
                </h1>
                {error && (
                  <div className="text-sm text-red-600 mt-1">{error}</div>
                )}
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
                      <OutlineButton onClick={() => fileRef.current?.click()}>
                        อัปโหลดรูปโปรไฟล์
                      </OutlineButton>
                      <OutlineButton onClick={() => setPwOpen(true)}>
                        เปลี่ยนรหัสผ่าน
                      </OutlineButton>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile form */}
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6">
                <h2 className="text-sm font-medium text-slate-900 mb-4 text-center">
                  แก้ไขข้อมูลส่วนตัว
                </h2>

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
                      <LabeledInput
                        label="ชื่อ"
                        value={first_name}
                        onChange={setFirstName}
                      />
                      <LabeledInput
                        label="นามสกุล"
                        value={last_name}
                        onChange={setLastName}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <LabeledInput
                        label="Username"
                        value={username}
                        onChange={setUsername}
                      />
                      <LabeledInput
                        label="อีเมล"
                        value={email}
                        onChange={setEmail}
                        placeholder="name@example.com"
                        error={email && !isEmail(email) ? "รูปแบบอีเมลไม่ถูกต้อง" : null}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <LabeledInput
                        label="เบอร์โทร"
                        value={phone}
                        onChange={setPhone}
                      />
                      <LabeledInput
                        label="ตำแหน่ง"
                        value={position}
                        onChange={setPosition}
                      />
                    </div>

                    <div className="grid grid-cols-1 mt-4">
                      <LabeledInput
                        label="หน่วยงาน/คณะ"
                        value={department}
                        onChange={setDepartment}
                      />
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

          {/* Modal: Change password */}
          {pwOpen && (
            <>
              <div
                className="fixed inset-0 bg-black/40 z-40"
                onClick={() => setPwOpen(false)}
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
                  <div className="px-5 py-4 bg-gradient-to-r from-blue-700 to-blue-500 text-white flex items-center justify-between">
                    <div className="text-base font-semibold">เปลี่ยนรหัสผ่าน</div>
                    <button
                      onClick={() => setPwOpen(false)}
                      className="text-white hover:bg-white/20 rounded-lg p-1.5"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="p-5 space-y-3">
                    <LabeledInput
                      label="รหัสผ่านเดิม"
                      value={curPw}
                      onChange={(v) => {
                        setCurPw(v);
                        setPwErrCur(null);
                      }}
                      type="password"
                      error={pwErrCur}
                    />
                    <LabeledInput
                      label="รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"
                      value={newPw}
                      onChange={(v) => {
                        setNewPw(v);
                        setPwErrNew(null);
                      }}
                      type="password"
                      error={pwErrNew}
                    />
                    <LabeledInput
                      label="ยืนยันรหัสผ่านใหม่"
                      value={newPw2}
                      onChange={(v) => {
                        setNewPw2(v);
                        setPwErrNew2(null);
                      }}
                      type="password"
                      error={pwErrNew2}
                    />

                    <div className="flex justify-end gap-2 pt-1">
                      <OutlineButton onClick={() => setPwOpen(false)}>
                        ยกเลิก
                      </OutlineButton>
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