'use client';

import { useEffect, useMemo, useState } from 'react';

/* ========= Types ========= */
type Role = 'ADMIN' | 'STAFF' | 'PROFESSOR';
type Status = 'ACTIVE' | 'SUSPENDED';

type UserRow = {
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  position: string | null;
  role: Role;
  status: Status;
  profile_image?: string | null; // public URL (or path)
  email?: string | null;         // <-- ใช้จริง (แก้ใหม่)
};

/* ========= Helpers ========= */
async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await res.text();
    throw new Error(`API returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}
function looksLikeEmail(s?: string | null) {
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function csvEscape(v: any) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/* ========= Constants ========= */
const ROLE_OPTIONS: Array<{ label: string; value: Role | 'ALL' }> = [
  { label: 'All', value: 'ALL' as any },
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Staff', value: 'STAFF' },
  { label: 'Professor', value: 'PROFESSOR' },
];

const STATUS_OPTIONS: Array<{ label: string; value: Status | 'ALL' }> = [
  { label: 'All', value: 'ALL' as any },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Suspended', value: 'SUSPENDED' },
];

/* ========= Page ========= */
export default function AdminUsersPage() {
  // filters
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<Status | 'ALL'>('ALL');

  // data
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // (optional) self reference for syncing avatar when editing yourself
  const [me, setMe] = useState<UserRow | null>(null);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [activeUser, setActiveUser] = useState<UserRow | null>(null);
  const [animEdit, setAnimEdit] = useState(false);

  // create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [animCreate, setAnimCreate] = useState(false);
  const [createForm, setCreateForm] = useState<{
    first_name: string;
    last_name: string;
    position: string;
    username: string;
    password: string;
    phone: string;
    role: Role;
    status: Status;
    email: string; // <-- เพิ่ม
  }>({
    first_name: '',
    last_name: '',
    position: 'อาจารย์',
    username: '',
    password: '',
    phone: '',
    role: 'PROFESSOR',
    status: 'ACTIVE',
    email: '', // <-- เพิ่ม
  });

  // paging
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // ปุ่ม Bulk Actions: มีการเลือกหรือไม่
  const hasSelection = selectedIds.length > 0;

  /* ====== Load list ====== */
  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users?q=' + encodeURIComponent(q.trim()), { cache: 'no-store' });
      const json = await safeJson(res);
      if (!res.ok || json?.ok === false) throw new Error(json?.message || 'load failed');

      const list: UserRow[] = (json.data || []).map((u: any) => ({
        user_id: u.user_id,
        username: u.username ?? null,
        first_name: u.first_name ?? null,
        last_name: u.last_name ?? null,
        phone: u.phone ?? null,
        position: u.position ?? null,
        role: u.role,
        status: u.status,
        profile_image: u.profile_image ?? null,
        // รองรับทั้งกรณี API มี email หรือ fallback จาก username ถ้าเป็นอีเมล
        email: u.email ?? (looksLikeEmail(u.username) ? u.username : null),
      }));

      setRows(list);
      setSelectedIds([]);
      if (!me) setMe(list[0] || null);
    } catch (e: any) {
      console.error('load users error:', e);
      alert(`โหลดข้อมูลผู้ใช้ล้มเหลว: ${e.message || e}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ====== Filtered ====== */
  const filtered = useMemo(() => {
    let r = rows;
    const t = q.trim().toLowerCase();
    if (t) {
      r = r.filter(
        (x) =>
          (x.username || '').toLowerCase().includes(t) ||
          (x.first_name || '').toLowerCase().includes(t) ||
          (x.last_name || '').toLowerCase().includes(t) ||
          (x.email || '').toLowerCase().includes(t),
      );
    }
    if (roleFilter !== 'ALL') r = r.filter((x) => x.role === roleFilter);
    if (statusFilter !== 'ALL') r = r.filter((x) => x.status === statusFilter);
    return r;
  }, [rows, q, roleFilter, statusFilter]);

  // page slice
  const pageStart = (page - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  /* ====== Select ====== */
  function toggleSelect(id: number, checked: boolean) {
    setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  }
  function toggleSelectAll(checked: boolean) {
    const ids = pageRows.map((x) => x.user_id);
    setSelectedIds((prev) => (checked ? Array.from(new Set([...prev, ...ids])) : prev.filter((x) => !ids.includes(x))));
  }

  function clearFilters() {
    setQ('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
  }

  /* ====== Row-level updates ====== */
  async function setRowStatus(userId: number, next: Status) {
    const target = rows.find((u) => u.user_id === userId);
    if (!target) return;
    if (!confirm(`ยืนยันการเปลี่ยนสถานะผู้ใช้เป็น ${next === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED'} ?`)) return;

    const prevStatus = target.status;
    setRows((r) => r.map((u) => (u.user_id === userId ? { ...u, status: next } : u)));
    try {
      const res = await fetch('/api/admin/users/' + userId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const json = await safeJson(res);
      if (!res.ok || json?.ok === false) throw new Error(json?.message || 'update failed');
      if (activeUser?.user_id === userId) setActiveUser({ ...activeUser, status: next });
    } catch (err: any) {
      setRows((r) => r.map((u) => (u.user_id === userId ? { ...u, status: prevStatus } : u)));
      alert(err.message || 'อัปเดตสถานะล้มเหลว');
    }
  }

  async function setRowRole(userId: number, next: Role) {
    const target = rows.find((u) => u.user_id === userId);
    if (!target) return;
    if (!confirm(`ยืนยันการเปลี่ยนบทบาทเป็น ${next}?`)) return;

    const prevRole = target.role;
    setRows((r) => r.map((u) => (u.user_id === userId ? { ...u, role: next } : u)));
    try {
      const res = await fetch('/api/admin/users/' + userId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: next }),
      });
      const json = await safeJson(res);
      if (!res.ok || json?.ok === false) throw new Error(json?.message || 'update failed');
      if (activeUser?.user_id === userId) setActiveUser({ ...activeUser, role: next });
    } catch (err: any) {
      setRows((r) => r.map((u) => (u.user_id === userId ? { ...u, role: prevRole } : u)));
      alert(err.message || 'อัปเดตบทบาทล้มเหลว');
    }
  }

  /* ====== Save user (Edit) ====== */
  async function saveActiveUser() {
    if (!activeUser) return;

    // validate email (ถ้ามี)
    if (activeUser.email && !looksLikeEmail(activeUser.email)) {
      alert('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    const payload = {
      username: activeUser.username,
      first_name: activeUser.first_name,
      last_name: activeUser.last_name,
      phone: activeUser.phone,
      position: activeUser.position,
      role: activeUser.role,
      status: activeUser.status,
      profile_image: activeUser.profile_image ?? null,
      email: activeUser.email ?? null, // <-- ส่งไปด้วย
    };
    const res = await fetch('/api/admin/users/' + activeUser.user_id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await safeJson(res);
    if (!res.ok || json?.ok === false) {
      alert(json?.message || 'save failed');
      return;
    }
    setRows((prev) => prev.map((u) => (u.user_id === activeUser.user_id ? { ...u, ...payload } : u)));
    alert('บันทึกการเปลี่ยนแปลงแล้ว');
  }

  /* ====== Bulk ====== */
  async function bulkSetStatus(status: Status) {
    if (!selectedIds.length) return;
    if (!confirm(`ยืนยันเปลี่ยนสถานะเป็น ${status} ให้ ${selectedIds.length} รายการ?`)) return;
    const before = rows;
    setRows((prev) => prev.map((u) => (selectedIds.includes(u.user_id) ? { ...u, status } : u)));
    try {
      for (const id of selectedIds) {
        const r = await fetch('/api/admin/users/' + id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        const j = await safeJson(r);
        if (!r.ok || j?.ok === false) throw new Error(j?.message || 'bulk status failed');
      }
    } catch (e: any) {
      setRows(before);
      alert(e.message || 'อัปเดตสถานะแบบกลุ่มล้มเหลว');
    }
  }

  /* ====== Create Professor (Full fields like Edit) ====== */
  async function createProfessor() {
    // validate
    if (!createForm.username || !createForm.password) {
      alert('กรุณากรอก Username และ Password');
      return;
    }
    if (!createForm.first_name || !createForm.last_name) {
      alert('กรุณากรอก ชื่อ และ นามสกุล');
      return;
    }
    if (createForm.email && !looksLikeEmail(createForm.email)) {
      alert('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    const payload = {
      username: createForm.username,
      password: createForm.password,
      first_name: createForm.first_name,
      last_name: createForm.last_name,
      phone: createForm.phone || null,
      position: createForm.position || null,
      role: createForm.role,
      status: createForm.status,
      email: createForm.email || null, // <-- ส่งอีเมลด้วย
    };

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // ถ้า API ฝั่ง server ต้องการ type สามารถเพิ่ม: type: 'CREATE_PROFESSOR'
      body: JSON.stringify(payload),
    });
    const json = await safeJson(res);
    if (!res.ok || json?.ok === false) {
      alert(json?.message || 'create failed');
      return;
    }
    setAnimCreate(false);
    setTimeout(() => setCreateOpen(false), 180);
    // reset form
    setCreateForm({
      first_name: '',
      last_name: '',
      position: 'อาจารย์',
      username: '',
      password: '',
      phone: '',
      role: 'PROFESSOR',
      status: 'ACTIVE',
      email: '',
    });
    await load();
  }

  /* ====== Export CSV ====== */
  function exportCSV() {
    const cols = ['user_id', 'username', 'email', 'first_name', 'last_name', 'phone', 'position', 'role', 'status']; // <-- เพิ่ม email
    const lines = [cols.join(',')].concat(filtered.map((u) => cols.map((c) => csvEscape((u as any)[c])).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'users.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ========= Render ========= */
  return (
    <div className="min-h-[70vh]">
      {/* Filters + bulk actions */}
      <div id="bulk-actions" className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 mb-4">
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-12 lg:col-span-4">
            <label className="text-xs text-gray-500">ค้นหา</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="username, อีเมล, ชื่อ, นามสกุล…"
              className="w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="col-span-12 sm:col-span-4 lg:col-span-4">
            <label className="text-xs text-gray-500">บทบาท</label>
            <SegmentedControl
              options={ROLE_OPTIONS}
              value={roleFilter}
              onChange={(v) => {
                setRoleFilter(v as Role | 'ALL');
                setPage(1);
              }}
            />
          </div>

          <div className="col-span-12 sm:col-span-4 lg:col-span-3">
            <label className="text-xs text-gray-500">สถานะ</label>
            <SegmentedControl
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v as Status | 'ALL');
                setPage(1);
              }}
            />
          </div>

          <div className="col-span-12 lg:col-span-1 flex gap-2 justify-end">
            <button
              onClick={() => {
                clearFilters();
                load();
              }}
              className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200"
            >
              ล้าง
            </button>
          </div>
        </div>

        {/* Bulk actions */}
        <div className="mt-4 border-t pt-3 text-sm text-gray-600 flex flex-wrap gap-2 items-center">
          <div className="text-xs text-gray-500">
            {hasSelection ? `เลือกแล้ว ${selectedIds.length} รายการ` : 'ยังไม่ได้เลือกผู้ใช้'}
          </div>

          <button
            disabled={!hasSelection}
            aria-disabled={!hasSelection}
            onClick={() => hasSelection && bulkSetStatus('SUSPENDED')}
            className={`px-3 py-1.5 rounded-lg transition ${
              hasSelection
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            title={hasSelection ? 'ระงับการใช้งาน' : 'กรุณาเลือกผู้ใช้ก่อน'}
          >
            ระงับการใช้งาน
          </button>

          <button
            disabled={!hasSelection}
            aria-disabled={!hasSelection}
            onClick={() => hasSelection && bulkSetStatus('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg transition ${
              hasSelection
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            title={hasSelection ? 'เปิดใช้งาน' : 'กรุณาเลือกผู้ใช้ก่อน'}
          >
            เปิดใช้งาน
          </button>

          <div className="ml-auto flex gap-2">
            <button
              onClick={() => {
                setCreateOpen(true);
                setTimeout(() => setAnimCreate(true), 10);
              }}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            >
              + เพิ่มผู้ใช้
            </button>
            <button onClick={exportCSV} className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700">
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-blue-50 to-blue-100 sticky top-0 z-10">
              <tr className="text-gray-700">
                <th className="w-10 py-3 px-2">
                  <input
                    type="checkbox"
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    checked={pageRows.length > 0 && pageRows.every((r) => selectedIds.includes(r.user_id))}
                    aria-label="เลือกทั้งหมดในหน้านี้"
                  />
                </th>
                <th className="w-12 px-2 py-3"></th>
                <th className="text-left py-3 px-3 font-medium">Username</th>
                <th className="text-left px-3 font-medium">ชื่อ</th>
                <th className="text-left px-3 font-medium">นามสกุล</th>
                <th className="text-left px-3 font-medium">อีเมล</th>
                <th className="text-left px-3 font-medium">บทบาท</th>
                <th className="text-left px-3 font-medium">สถานะ</th>
                <th className="w-[140px] text-center px-3 py-3 font-medium">การจัดการ</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-gray-500">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-gray-500">
                    ไม่พบผู้ใช้
                  </td>
                </tr>
              ) : (
                pageRows.map((u) => (
                  <tr key={u.user_id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 px-2 align-middle">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(u.user_id)}
                        onChange={(e) => toggleSelect(u.user_id, e.target.checked)}
                        aria-label={`เลือกผู้ใช้ ${u.username ?? ''}`}
                      />
                    </td>

                    <td className="px-2 py-2 align-middle">
                      <Avatar url={u.profile_image} size={28} />
                    </td>

                    {/* เปิด modal ด้วยการคลิกที่ username */}
                    <td className="px-3 py-3 align-middle">
                      <button
                        onClick={() => {
                          setActiveUser(u);
                          setEditOpen(true);
                          setTimeout(() => setAnimEdit(true), 10);
                        }}
                        className="text-slate-900 hover:underline font-medium"
                      >
                        {u.username ?? '-'}
                      </button>
                    </td>
                    <td className="px-3 py-3">{u.first_name ?? '-'}</td>
                    <td className="px-3 py-3">{u.last_name ?? '-'}</td>
                    <td className="px-3 py-3">{u.email ?? '-'}</td>
                    <td className="px-3 py-3">
                      <Badge role={u.role} />
                    </td>
                    <td className="px-3 py-3">
                      <Pill status={u.status} />
                    </td>

                    {/* การจัดการ */}
                    <td className="px-3 py-2 align-middle text-center">
                      <div className="inline-flex gap-2">
                        <IconButton
                          label="แก้ไข"
                          onClick={() => {
                            setActiveUser(u);
                            setEditOpen(true);
                            setTimeout(() => setAnimEdit(true), 10);
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M14.06 6.19l3.75 3.75" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                        </IconButton>

                        {u.status === 'ACTIVE' ? (
                          <ChipButton label="ระงับ" tone="warn" onClick={() => setRowStatus(u.user_id, 'SUSPENDED')} />
                        ) : (
                          <ChipButton label="เปิดใช้" tone="ok" onClick={() => setRowStatus(u.user_id, 'ACTIVE')} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between px-4 py-3 text-sm text-gray-600 border-t">
          <div>
            แสดง {filtered.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + pageSize, filtered.length)} จาก {rows.length} ผู้ใช้
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-40"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ก่อนหน้า
            </button>
            <button className="px-3 py-1.5 rounded-lg border hover:bg-gray-50" onClick={() => setPage((p) => p + 1)}>
              หน้าถัดไป
            </button>
          </div>
        </div>
      </div>

      {/* ===== Modal: Edit User ===== */}
      {editOpen && activeUser && (
        <>
          <div
            className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${animEdit ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => {
              setAnimEdit(false);
              setTimeout(() => {
                setEditOpen(false);
                setActiveUser(null);
              }, 180);
            }}
          />
          <div
            className={`fixed inset-0 z-50 flex items-center justify-center transition duration-200 ease-out ${
              animEdit ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-blue-700 to-blue-500 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Avatar url={activeUser.profile_image} size={40} />
                  <div>
                    <h2 className="text-lg font-semibold">แก้ไขผู้ใช้</h2>
                    <p className="text-xs opacity-80">{activeUser.username || '—'}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setAnimEdit(false);
                    setTimeout(() => {
                      setEditOpen(false);
                      setActiveUser(null);
                    }, 180);
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-1.5"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Upload avatar */}
                <div className="flex items-center gap-3">
                  <Avatar url={activeUser.profile_image} size={56} />
                  <span className="text-xs text-gray-500">* Admin ไม่มีสิทธิ์ในการแก้ไขโปรไฟล์ผู้ใช้</span>
                </div>

                <LabeledInputBlue label="Username" value={activeUser.username ?? ''} onChange={(v) => setActiveUser({ ...activeUser, username: v })} />

                <div className="grid grid-cols-2 gap-3">
                  <LabeledInputBlue label="ชื่อ" value={activeUser.first_name ?? ''} onChange={(v) => setActiveUser({ ...activeUser, first_name: v })} />
                  <LabeledInputBlue label="นามสกุล" value={activeUser.last_name ?? ''} onChange={(v) => setActiveUser({ ...activeUser, last_name: v })} />
                </div>

                <LabeledInputBlue label="อีเมล" value={activeUser.email ?? ''} onChange={(v) => setActiveUser({ ...activeUser, email: v })} />
                <LabeledInputBlue label="เบอร์โทร" value={activeUser.phone ?? ''} onChange={(v) => setActiveUser({ ...activeUser, phone: v })} />
                <LabeledInputBlue label="ตำแหน่ง" value={activeUser.position ?? ''} onChange={(v) => setActiveUser({ ...activeUser, position: v })} />

                {/* Role + Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">บทบาท</p>
                    <div className="flex gap-2 flex-wrap">
                      {(['ADMIN', 'STAFF', 'PROFESSOR'] as Role[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => setRowRole(activeUser.user_id, r)}
                          className={`px-3 py-1.5 rounded-lg border text-sm ${
                            activeUser.role === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">สถานะ</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRowStatus(activeUser.user_id, 'ACTIVE')}
                        className={`px-3 py-1.5 rounded-lg text-sm ${
                          activeUser.status === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'bg-gray-100'
                        }`}
                      >
                        ACTIVE
                      </button>
                      <button
                        onClick={() => setRowStatus(activeUser.user_id, 'SUSPENDED')}
                        className={`px-3 py-1.5 rounded-lg text-sm ${
                          activeUser.status === 'SUSPENDED' ? 'bg-amber-500 text-white' : 'bg-gray-100'
                        }`}
                      >
                        SUSPENDED
                      </button>
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-2 pt-2">
                  <button onClick={saveActiveUser} className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700">
                    บันทึกการเปลี่ยนแปลง
                  </button>
                  <button
                    onClick={async () => {
                      const pw = prompt('กำหนดรหัสผ่านใหม่:');
                      if (!pw) return;
                      if (!confirm('ยืนยันการเปลี่ยนรหัสผ่านผู้ใช้นี้?')) return;
                      const res = await fetch('/api/admin/users/reset-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: activeUser.user_id, new_password: pw }),
                      });
                      const json = await safeJson(res);
                      if (!res.ok || json?.ok === false) alert(json?.message || 'reset error');
                      else alert('รีเซ็ตรหัสผ่านแล้ว');
                    }}
                    className="w-full rounded-lg border border-blue-600 px-4 py-3 font-medium text-blue-600 hover:bg-blue-50"
                  >
                    รีเซ็ตรหัสผ่าน
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== Modal: Create User (FULL fields like Edit) ===== */}
      {createOpen && (
        <>
          <div
            className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${animCreate ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => {
              setAnimCreate(false);
              setTimeout(() => setCreateOpen(false), 180);
            }}
          />
          <div
            className={`fixed inset-0 z-50 flex items-center justify-center transition duration-200 ease-out ${
              animCreate ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-blue-700 to-blue-500 text-white flex justify-between items-center">
                <h2 className="text-lg font-semibold">เพิ่มผู้ใช้ (อาจารย์)</h2>
                <button
                  onClick={() => {
                    setAnimCreate(false);
                    setTimeout(() => setCreateOpen(false), 180);
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-1.5"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-3">
                {/* Name */}
                <div className="grid grid-cols-2 gap-3">
                  <LabeledInputBlue
                    label="ชื่อ"
                    value={createForm.first_name}
                    onChange={(v) => setCreateForm({ ...createForm, first_name: v })}
                  />
                  <LabeledInputBlue
                    label="นามสกุล"
                    value={createForm.last_name}
                    onChange={(v) => setCreateForm({ ...createForm, last_name: v })}
                  />
                </div>

                {/* Position */}
                <LabeledInputBlue
                  label="ตำแหน่ง"
                  value={createForm.position}
                  onChange={(v) => setCreateForm({ ...createForm, position: v })}
                />

                {/* Contact */}
                <LabeledInputBlue
                  label="เบอร์โทร"
                  value={createForm.phone}
                  onChange={(v) => setCreateForm({ ...createForm, phone: v })}
                />

                {/* Credentials */}
                <LabeledInputBlue
                  label="Username"
                  value={createForm.username}
                  onChange={(v) => setCreateForm({ ...createForm, username: v })}
                />
                <LabeledInputBlue
                  label="Password"
                  type="password"
                  value={createForm.password}
                  onChange={(v) => setCreateForm({ ...createForm, password: v })}
                />

                {/* Email */}
                <LabeledInputBlue
                  label="อีเมล"
                  value={createForm.email}
                  onChange={(v) => setCreateForm({ ...createForm, email: v })}
                  placeholder="name@example.com"
                />

                {/* Role + Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">บทบาท</p>
                    <div className="flex gap-2 flex-wrap">
                      {(['ADMIN', 'STAFF', 'PROFESSOR'] as Role[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => setCreateForm((f) => ({ ...f, role: r }))}
                          className={`px-3 py-1.5 rounded-lg border text-sm ${
                            createForm.role === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">สถานะ</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCreateForm((f) => ({ ...f, status: 'ACTIVE' }))}
                        className={`px-3 py-1.5 rounded-lg text-sm ${
                          createForm.status === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'bg-gray-100'
                        }`}
                      >
                        ACTIVE
                      </button>
                      <button
                        onClick={() => setCreateForm((f) => ({ ...f, status: 'SUSPENDED' }))}
                        className={`px-3 py-1.5 rounded-lg text-sm ${
                          createForm.status === 'SUSPENDED' ? 'bg-amber-500 text-white' : 'bg-gray-100'
                        }`}
                      >
                        SUSPENDED
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                    onClick={() => {
                      setAnimCreate(false);
                      setTimeout(() => setCreateOpen(false), 180);
                    }}
                  >
                    ยกเลิก
                  </button>
                  <button className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" onClick={createProfessor}>
                    บันทึก
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ========= Small UI components ========= */

function Avatar({ url, size = 32 }: { url?: string | null; size?: number }) {
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
        <svg viewBox="0 0 24 24" width={Math.floor(size * 0.6)} height={Math.floor(size * 0.6)} className="text-gray-400">
          <path
            fill="currentColor"
            d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5.33 0-8 2.667-8 6v1h16v-1c0-3.333-2.67-6-8-6z"
          />
        </svg>
      )}
    </div>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 p-1 shadow-inner">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-full text-sm transition ${
              active ? 'bg-white shadow text-slate-900' : 'text-gray-600 hover:text-slate-900'
            }`}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function LabeledInputBlue({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <input
        type={type}
        className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function Badge({ role }: { role: Role }) {
  const base = 'text-xs px-2 py-1 rounded-md border inline-block select-none';
  const map: Record<Role, string> = {
    ADMIN: 'bg-blue-50 text-blue-700 border-blue-200',
    STAFF: 'bg-sky-50 text-sky-700 border-sky-200',
    PROFESSOR: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };
  return <span className={`${base} ${map[role]}`}>{role}</span>;
}

function Pill({ status }: { status: Status }) {
  const base = 'text-xs px-3 py-1 rounded-full inline-block select-none';
  return status === 'ACTIVE' ? (
    <span className={`${base} bg-emerald-100 text-emerald-700`}>ACTIVE</span>
  ) : (
    <span className={`${base} bg-amber-100 text-amber-700`}>SUSPENDED</span>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200
                 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition
                 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
    >
      {children}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function ChipButton({
  label,
  onClick,
  tone = 'neutral',
}: {
  label: string;
  onClick: () => void;
  tone?: 'neutral' | 'ok' | 'warn';
}) {
  const styles =
    tone === 'ok'
      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
      : tone === 'warn'
      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${styles}`}>
      {label}
    </button>
  );
}