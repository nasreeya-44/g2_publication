'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

type Me = {
  user_id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  role: 'ADMIN' | 'STAFF' | 'PROFESSOR';
  status: 'ACTIVE' | 'SUSPENDED' | string;
  profile_image: string | null;
};

export default function ProfessorProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [username, setUsername]   = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [position, setPosition]   = useState('');

  // modal เปลี่ยนรหัสผ่าน
  const [pwdOpen, setPwdOpen] = useState(false);
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdErr, setPwdErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch('/api/me/detail', { cache: 'no-store' });
        const json = await res.json();
        if (!alive) return;
        if (!res.ok || !json?.ok) throw new Error(json?.message || 'โหลดข้อมูลไม่สำเร็จ');

        const data: Me = json.data;
        setMe(data);
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setUsername(data.username || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setPosition(data.position || '');
      } catch (e: any) {
        setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function saveProfile() {
    setErr(null); setMsg(null); setSaving(true);
    try {
      const res = await fetch('/api/me/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName || null,
          last_name:  lastName  || null,
          username:   username  || null,
          email:      email     || null,
          phone:      phone     || null,
          position:   position  || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message || 'บันทึกไม่สำเร็จ');
      setMe(json.data as Me);
      setMsg('บันทึกการแก้ไขแล้ว');
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  function chooseFile() {
    fileRef.current?.click();
  }

  async function uploadAvatar(file: File) {
    setErr(null); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/me/avatar', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message || 'อัปโหลดรูปไม่สำเร็จ');
      setMe((m) => (m ? { ...m, profile_image: json.url as string } : m));
      setMsg('อัปโหลดรูปโปรไฟล์เรียบร้อย');
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function fullName() {
    const n = `${firstName || ''} ${lastName || ''}`.trim();
    return n || username || 'ผู้ใช้';
  }

  const avatar =
    me?.profile_image ||
    `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(me?.username || 'user')}`;

  // ---------- เปลี่ยนรหัสผ่าน ----------
  async function submitChangePassword() {
    setPwdErr(null); setPwdMsg(null);
    if (!curPwd || !newPwd || !newPwd2) {
      setPwdErr('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    if (newPwd !== newPwd2) {
      setPwdErr('รหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }
    if (newPwd.length < 8) {
      setPwdErr('รหัสผ่านใหม่ควรมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    setPwdLoading(true);
    try {
      const res = await fetch('/api/me/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: curPwd,
          new_password: newPwd,
          confirm_password: newPwd2,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
      setPwdMsg('เปลี่ยนรหัสผ่านเรียบร้อย');
      setCurPwd('');
      setNewPwd('');
      setNewPwd2('');
      // ปิด modal อัตโนมัติหลัง 1.2 วิ
      setTimeout(() => setPwdOpen(false), 1200);
    } catch (e: any) {
      setPwdErr(e?.message || String(e));
    } finally {
      setPwdLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-center text-2xl font-bold mb-6">โปรไฟล์ของฉัน</h1>

      {loading ? (
        <div className="text-center text-zinc-500">กำลังโหลด...</div>
      ) : err ? (
        <div className="text-center text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
          {err}
        </div>
      ) : (
        <>
          {/* Avatar card */}
          <div className="bg-white border rounded-2xl shadow-sm p-6 mb-6 text-center">
            <div className="mx-auto h-28 w-28 relative">
              <Image
                src={avatar}
                alt="avatar"
                fill
                sizes="112px"
                className="rounded-full object-cover ring-4 ring-zinc-100"
              />
            </div>
            <div className="mt-4 text-lg font-semibold">{fullName()}</div>
            <div className="text-xs uppercase text-zinc-500">
              {(me?.role || '').toUpperCase()} • {(me?.status || '').toUpperCase()}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <button
                onClick={chooseFile}
                className="px-4 py-2 rounded-xl border bg-white hover:bg-zinc-50"
              >
                อัปโหลดรูปโปรไฟล์
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                }}
              />

              <button
                onClick={() => setPwdOpen(true)}
                className="px-4 py-2 rounded-xl border bg-white hover:bg-zinc-50"
              >
                เปลี่ยนรหัสผ่าน
              </button>
            </div>
          </div>

          {/* Form card */}
          <div className="bg-white border rounded-2xl shadow-sm p-6">
            <div className="text-center font-medium mb-4">แก้ไขข้อมูลส่วนตัว</div>

            {msg && (
              <div className="mb-4 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
                {msg}
              </div>
            )}

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-6">
                <label className="text-xs text-zinc-500">ชื่อ</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 w-full h-11 rounded-xl border px-3"
                  placeholder="Somchai"
                />
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="text-xs text-zinc-500">นามสกุล</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 w-full h-11 rounded-xl border px-3"
                  placeholder="Sukjai"
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className="text-xs text-zinc-500">Username</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 w-full h-11 rounded-xl border px-3"
                  placeholder="username"
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className="text-xs text-zinc-500">อีเมล</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full h-11 rounded-xl border px-3"
                  placeholder="name@example.com"
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className="text-xs text-zinc-500">เบอร์โทร</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full h-11 rounded-xl border px-3"
                  placeholder="08x-xxx-xxxx"
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className="text-xs text-zinc-500">ตำแหน่ง</label>
                <input
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="mt-1 w-full h-11 rounded-xl border px-3"
                  placeholder="อาจารย์ / ผู้ช่วยศาสตราจารย์ ..."
                />
              </div>
            </div>

            <div className="mt-5 text-center">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="inline-flex items-center justify-center px-6 h-11 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </div>

          {/* ---------- Modal เปลี่ยนรหัสผ่าน ---------- */}
          {pwdOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="w-[520px] max-w-[92vw] rounded-2xl bg-white p-5 shadow-xl">
                <div className="text-lg font-semibold mb-3">เปลี่ยนรหัสผ่าน</div>

                {pwdMsg && (
                  <div className="mb-3 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                    {pwdMsg}
                  </div>
                )}
                {pwdErr && (
                  <div className="mb-3 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                    {pwdErr}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-500">รหัสผ่านเดิม</label>
                    <input
                      type="password"
                      value={curPwd}
                      onChange={(e) => setCurPwd(e.target.value)}
                      className="mt-1 w-full h-11 rounded-xl border px-3"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500">รหัสผ่านใหม่</label>
                    <input
                      type="password"
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      className="mt-1 w-full h-11 rounded-xl border px-3"
                      placeholder="อย่างน้อย 8 ตัวอักษร"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500">ยืนยันรหัสผ่านใหม่</label>
                    <input
                      type="password"
                      value={newPwd2}
                      onChange={(e) => setNewPwd2(e.target.value)}
                      className="mt-1 w-full h-11 rounded-xl border px-3"
                      placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    onClick={() => { setPwdOpen(false); setPwdErr(null); setPwdMsg(null); }}
                    className="px-4 h-10 rounded-xl border bg-white"
                    disabled={pwdLoading}
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={submitChangePassword}
                    disabled={pwdLoading}
                    className="px-5 h-10 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {pwdLoading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
  