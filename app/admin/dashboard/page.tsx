'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import LogoutButton from '@/components/LogoutButton';

// ---------- Types (อิงตามตาราง public.user) ----------
type Role = 'ADMIN' | 'STAFF' | 'PROFESSOR';
type Status = 'ACTIVE' | 'SUSPENDED';

type UserRow = {
  user_id: number;
  username: string | null;
  password_hash?: string | null; // ไม่ใช้บน UI
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  position: string | null;
  status: Status;
  role: Role;
  // UI only:
  email?: string | null;        // ใน schema เดิมไม่มีคอลัมน์นี้
  updated_logs?: string[];      // เดโม่โชว์ในพาเนลขวา
};

// ---------- Badge helpers ----------
function RoleBadge({ role }: { role: Role }) {
  const base = 'text-xs px-2 py-1 rounded-md border inline-block select-none';
  const map: Record<Role, string> = {
    ADMIN: 'bg-slate-200 text-slate-700 border-slate-300',
    STAFF: 'bg-slate-100 text-slate-700 border-slate-200',
    PROFESSOR: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return <span className={`${base} ${map[role]}`}>{role}</span>;
}
function StatusPill({ status }: { status: Status }) {
  const base = 'text-xs px-3 py-1 rounded-full inline-block select-none';
  return status === 'ACTIVE'
    ? <span className={`${base} bg-green-100 text-green-700`}>เปิดใช้งาน</span>
    : <span className={`${base} bg-amber-100 text-amber-700`}>ระงับ</span>;
}

const ROLES: Role[] = ['ADMIN', 'STAFF', 'PROFESSOR'];
const STATUSES: Status[] = ['ACTIVE', 'SUSPENDED'];

export default function AdminDashboardPage() {
  // Filters
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<Status | 'ALL'>('ALL');

  // Data
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeUser, setActiveUser] = useState<UserRow | null>(null);

  // Pagination (client-side)
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // ดึงข้อมูลจาก Supabase -> ตาราง public.user
  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseBrowser();

    (async () => {
      setLoading(true);
      try {
        // เลือกคอลัมน์ที่มีใน schema ของคุณ
        const { data, error } = await supabase
          .from('users')
          .select('user_id, username, first_name, last_name, phone, position, status, role')
          .order('user_id', { ascending: true });

        if (error) throw error;

        // map เพิ่ม field email สำหรับ UI (ใช้ username หากคล้ายอีเมล)
        const mapped: UserRow[] = (data || []).map((u: any) => ({
          ...u,
          email: looksLikeEmail(u.username) ? u.username : null,
          updated_logs: [], // คุณสามารถดึงจากตาราง log ของคุณมารวมได้
        }));

        if (!cancelled) {
          setRows(mapped);
          if (!activeUser && mapped.length) setActiveUser(mapped[0]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtered rows
  const filtered = useMemo(() => {
    let r = rows;
    const t = q.trim().toLowerCase();
    if (t) {
      r = r.filter((x) =>
        (x.username || '').toLowerCase().includes(t) ||
        (x.first_name || '').toLowerCase().includes(t) ||
        (x.last_name || '').toLowerCase().includes(t) ||
        (x.email || '').toLowerCase().includes(t)
      );
    }
    if (roleFilter !== 'ALL') r = r.filter((x) => x.role === roleFilter);
    if (statusFilter !== 'ALL') r = r.filter((x) => x.status === statusFilter);
    return r;
  }, [rows, q, roleFilter, statusFilter]);

  // Pagination slice
  const pageStart = (page - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  // Selectors
  function toggleSelect(id: number, checked: boolean) {
    setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  }
  function toggleSelectAll(checked: boolean) {
    if (checked) {
      const ids = pageRows.map((x) => x.user_id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
    } else {
      const ids = pageRows.map((x) => x.user_id);
      setSelectedIds((prev) => prev.filter((x) => !ids.includes(x)));
    }
  }
  function clearFilters() {
    setQ('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
  }

  // ----- Actions -> อัปเดตตาราง public.user โดยตรง -----
  async function saveActiveUser() {
    if (!activeUser) return;
    const supabase = supabaseBrowser();
    const payload = {
      username: activeUser.username,
      first_name: activeUser.first_name,
      last_name: activeUser.last_name,
      phone: activeUser.phone,
      position: activeUser.position,
      role: activeUser.role,
      status: activeUser.status,
    };
    const { error } = await supabase.from('users').update(payload).eq('user_id', activeUser.user_id);
    if (error) {
      alert(error.message);
      return;
    }
    alert('บันทึกการเปลี่ยนแปลงแล้ว');
    // รีโหลดเล็กน้อยให้ข้อมูลตรง
    setRows((prev) => prev.map((u) => (u.user_id === activeUser.user_id ? { ...u, ...payload } : u)));
  }

  async function setActiveStatus(status: Status) {
    if (!activeUser) return;
    const supabase = supabaseBrowser();
    const { error } = await supabase.from('users').update({ status }).eq('user_id', activeUser.user_id);
    if (error) return alert(error.message);
    setActiveUser({ ...activeUser, status });
    setRows((prev) => prev.map((u) => (u.user_id === activeUser.user_id ? { ...u, status } : u)));
  }

  async function setActiveRole(role: Role) {
    if (!activeUser) return;
    const supabase = supabaseBrowser();
    const { error } = await supabase.from('users').update({ role }).eq('user_id', activeUser.user_id);
    if (error) return alert(error.message);
    setActiveUser({ ...activeUser, role });
    setRows((prev) => prev.map((u) => (u.user_id === activeUser.user_id ? { ...u, role } : u)));
  }

  async function bulkSetRole(role: Role) {
    if (selectedIds.length === 0) return;
    const supabase = supabaseBrowser();
    const { error } = await supabase.from('users').update({ role }).in('user_id', selectedIds);
    if (error) return alert(error.message);
    setRows((prev) => prev.map((u) => (selectedIds.includes(u.user_id) ? { ...u, role } : u)));
  }
  async function bulkSuspend() {
    if (selectedIds.length === 0) return;
    const supabase = supabaseBrowser();
    const { error } = await supabase.from('users').update({ status: 'SUSPENDED' }).in('user_id', selectedIds);
    if (error) return alert(error.message);
    setRows((prev) => prev.map((u) => (selectedIds.includes(u.user_id) ? { ...u, status: 'SUSPENDED' } : u)));
  }
  async function bulkActivate() {
    if (selectedIds.length === 0) return;
    const supabase = supabaseBrowser();
    const { error } = await supabase.from('users').update({ status: 'ACTIVE' }).in('user_id', selectedIds);
    if (error) return alert(error.message);
    setRows((prev) => prev.map((u) => (selectedIds.includes(u.user_id) ? { ...u, status: 'ACTIVE' } : u)));
  }

  // หมายเหตุ: การรีเซ็ตรหัสผ่านหากคุณทำ auth เองในตารางนี้
  // ควรทำผ่าน API ฝั่งเซิร์ฟเวอร์เพื่อ hash รหัส (ห้ามส่ง plain hash จาก client)
  async function bulkResetPassword() {
    alert('แนะนำให้ทำ /api/admin/users/bulk-reset-password (server) เพื่อ hash รหัสผ่านอย่างปลอดภัย');
  }
  async function activeResetPassword() {
    alert('แนะนำให้ทำ /api/admin/users/[id]/reset-password (server) เพื่อ hash รหัสผ่านอย่างปลอดภัย');
  }

  // UI
  const totalCount = rows.length;
  const currentUser = { username: 'admin01', role: 'ADMIN' as Role };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="flex items-center justify-end px-6 py-3">
        <div className="text-sm text-gray-600">
          ผู้ใช้: <span className="font-semibold">{currentUser.username}</span>{' '}
          (<span className="uppercase">{currentUser.role}</span>)
        </div>
        <div className='flex px-6'><LogoutButton /></div>
        
      </div>

      <main className="px-6 pb-8">
        <h1 className="text-xl font-semibold mb-4">จัดการบัญชีผู้ใช้</h1>
             

        {/* Filters + actions */}
        <div className="bg-white rounded-xl shadow p-4 mb-3">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 lg:col-span-4">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหา: username, ชื่อ, นามสกุล, อีเมล..."
                className="w-full border rounded-xl px-4 py-2"
              />
            </div>

            {/* Role summary pill */}
            <div className="col-span-12 sm:col-span-4 lg:col-span-3 flex items-center">
              <button
                className={`px-3 py-2 rounded-xl text-sm border ${roleFilter === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-700'}`}
                onClick={() =>
                  setRoleFilter((prev) =>
                    prev === 'ALL' ? 'ADMIN' : prev === 'ADMIN' ? 'STAFF' : prev === 'STAFF' ? 'PROFESSOR' : 'ALL'
                  )
                }
                title="คลิกเพื่อสลับ ADMIN → STAFF → PROFESSOR → ทั้งหมด"
              >
                ทั้งหมด / ADMIN / STAFF / PROFESSOR
              </button>
            </div>

            {/* Status summary pill */}
            <div className="col-span-12 sm:col-span-4 lg:col-span-3 flex items-center">
              <button
                className={`px-3 py-2 rounded-xl text-sm border ${statusFilter === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-700'}`}
                onClick={() =>
                  setStatusFilter((prev) => (prev === 'ALL' ? 'ACTIVE' : prev === 'ACTIVE' ? 'SUSPENDED' : 'ALL'))
                }
                title="คลิกเพื่อสลับ ACTIVE → SUSPENDED → ทั้งหมด"
              >
                ACTIVE / SUSPENDED
              </button>
            </div>

            <div className="col-span-12 lg:col-span-2 flex gap-2 justify-end">
              <button onClick={() => { setQ(''); setRoleFilter('ALL'); setStatusFilter('ALL'); }} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">ล้างตัวกรอง</button>
              <button onClick={() => alert('เพิ่มผู้ใช้ใหม่')} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm">+ เพิ่มผู้ใช้</button>
              <button onClick={() => alert('Export CSV')} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm">Export CSV</button>
            </div>
          </div>

          {/* Bulk actions */}
          <div className="mt-4 border-t pt-3 text-sm text-gray-600">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => bulkSetRole('PROFESSOR')} className="px-3 py-1.5 rounded-lg bg-gray-100">กำหนดบทบาท</button>
              <button onClick={bulkSuspend} className="px-3 py-1.5 rounded-lg bg-gray-100">ระงับการใช้งาน</button>
              <button onClick={bulkActivate} className="px-3 py-1.5 rounded-lg bg-gray-100">เปิดใช้งาน</button>
              <button onClick={bulkResetPassword} className="px-3 py-1.5 rounded-lg bg-gray-100">รีเซ็ตรหัสผ่าน</button>
              <span className="text-xs text-gray-500 ml-2">* เลือกผู้ใช้หลายแถวจากตารางด้านล่าง</span>
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Table */}
          <div className="col-span-12 xl:col-span-8 2xl:col-span-9">
            <div className="bg-white rounded-xl shadow p-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="w-10 py-3 px-2">
                        <input
                          type="checkbox"
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          checked={pageRows.length > 0 && pageRows.every((r) => selectedIds.includes(r.user_id))}
                        />
                      </th>
                      <th className="text-left py-3 px-2">Username</th>
                      <th className="text-left px-2">ชื่อ</th>
                      <th className="text-left px-2">นามสกุล</th>
                      <th className="text-left px-2">อีเมล</th>
                      <th className="text-left px-2">บทบาท</th>
                      <th className="text-left px-2">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-gray-500">กำลังโหลด...</td>
                      </tr>
                    ) : pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-gray-500">ไม่พบผู้ใช้</td>
                      </tr>
                    ) : (
                      pageRows.map((u) => (
                        <tr key={u.user_id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setActiveUser(u)}>
                          <td className="py-2 px-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(u.user_id)}
                              onChange={(e) => toggleSelect(u.user_id, e.target.checked)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-2 py-2">{u.username ?? '-'}</td>
                          <td className="px-2">{u.first_name ?? '-'}</td>
                          <td className="px-2">{u.last_name ?? '-'}</td>
                          <td className="px-2">{u.email ?? '-'}</td>
                          <td className="px-2"><RoleBadge role={u.role} /></td>
                          <td className="px-2"><StatusPill status={u.status} /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer / pagination */}
              <div className="flex items-center justify-between px-3 py-3 text-sm text-gray-600">
                <div>แสดง {pageStart + 1}-{Math.min(pageStart + pageSize, filtered.length || 0)} จาก {totalCount} ผู้ใช้</div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 rounded-lg border" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>ก่อนหน้า</button>
                  <button className="px-3 py-1 rounded-lg border" onClick={() => setPage((p) => p + 1)}>หน้าถัดไป</button>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="col-span-12 xl:col-span-4 2xl:col-span-3">
            <div className="bg-white rounded-xl shadow p-4 sticky top-4">
              <h3 className="font-semibold mb-3">แก้ไขผู้ใช้</h3>

              {!activeUser ? (
                <p className="text-sm text-gray-500">เลือกผู้ใช้จากตาราง</p>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-gray-500">Username</div>
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={activeUser.username ?? ''}
                    onChange={(e) => setActiveUser({ ...activeUser, username: e.target.value })}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-500">ชื่อ</div>
                      <input
                        className="w-full border rounded-lg px-3 py-2"
                        value={activeUser.first_name ?? ''}
                        onChange={(e) => setActiveUser({ ...activeUser, first_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">นามสกุล</div>
                      <input
                        className="w-full border rounded-lg px-3 py-2"
                        value={activeUser.last_name ?? ''}
                        onChange={(e) => setActiveUser({ ...activeUser, last_name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">อีเมล</div>
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      value={activeUser.email ?? ''}
                      onChange={(e) => setActiveUser({ ...activeUser, email: e.target.value })}
                      //placeholder="(ใน schema เดิมใช้ username แทนได้)"
                    />
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">เบอร์โทร</div>
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      value={activeUser.phone ?? ''}
                      onChange={(e) => setActiveUser({ ...activeUser, phone: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">บทบาท</div>
                      <div className="flex flex-wrap gap-2">
                        {ROLES.map((r) => (
                          <button
                            key={r}
                            onClick={() => setActiveRole(r)}
                            className={`px-3 py-1.5 rounded-lg border text-sm ${activeUser.role === r ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-700'}`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">สถานะ</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setActiveStatus('ACTIVE')}
                          className={`px-3 py-1.5 rounded-lg text-sm ${activeUser.status === 'ACTIVE' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}
                        >
                          เปิดใช้งาน
                        </button>
                        <button
                          onClick={() => setActiveStatus('SUSPENDED')}
                          className={`px-3 py-1.5 rounded-lg text-sm ${activeUser.status === 'SUSPENDED' ? 'bg-amber-500 text-white' : 'bg-gray-100'}`}
                        >
                          ระงับบัญชี
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button onClick={saveActiveUser} className="px-4 py-2 rounded-lg bg-blue-600 text-white">บันทึกการเปลี่ยนแปลง</button>
                    <button onClick={() => setActiveStatus('ACTIVE')} className="px-4 py-2 rounded-lg bg-emerald-600 text-white">เปิดใช้งาน</button>
                    <button onClick={activeResetPassword} className="px-4 py-2 rounded-lg bg-slate-800 text-white">รีเซ็ตรหัสผ่าน</button>
                    <button onClick={() => setActiveStatus('SUSPENDED')} className="px-4 py-2 rounded-lg bg-amber-500 text-white">ระงับบัญชี</button>
                  </div>

                  <div className="pt-2">
                    <div className="text-xs text-gray-500 mb-1">ประวัติการแก้ไขล่าสุด</div>
                    <div className="text-sm bg-gray-50 border rounded-lg p-3 space-y-1">
                      {(activeUser.updated_logs || []).length === 0 ? (
                        <div className="text-gray-500">—</div>
                      ) : (
                        (activeUser.updated_logs || []).map((l, i) => <div key={i}>{l}</div>)
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------- Utils ----------
function looksLikeEmail(s?: string | null) {
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
