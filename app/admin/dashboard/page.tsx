'use client';

import { useEffect, useState } from 'react';

/* ================= Helpers ================= */
async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const t = await res.text().catch(() => '');
    throw new Error(`API non-JSON (${res.status}): ${t.slice(0, 180)}`);
  }
  return res.json();
}

/* ================= Types ================= */
type Role = 'ADMIN' | 'STAFF' | 'PROFESSOR';

type UserMetrics = {
  total_users: number;
  active_users: number;
  suspended_users: number;
  by_role: Record<Role, number>;
};

type AuditRow = {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;   // LOGIN / LOGOUT / LOGIN_FAIL (normalized)
  ip: string | null;
  ts: string;       // ISO time (normalized)
};

/* ================= Page ================= */
export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const AUDIT_LIMIT = 10;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // ดึงสรุปผู้ใช้
      const mRes = await fetch('/api/admin/metrics/users', { cache: 'no-store' });
      const mJson = await safeJson(mRes);
      if (!mRes.ok || mJson?.ok === false) {
        throw new Error(mJson?.message || 'load metrics failed');
      }

      // ดึงประวัติการเข้าใช้งานล่าสุด
      const aRes = await fetch(`/api/admin/audit?limit=${AUDIT_LIMIT}`, { cache: 'no-store' });
      const aJson = await safeJson(aRes);
      if (!aRes.ok || aJson?.ok === false) {
        throw new Error(aJson?.message || 'load audit failed');
      }

      // ✅ Normalize audit rows ให้เป็นรูปแบบเดียว (รองรับทั้งสอง schema)
      const rows: AuditRow[] = (aJson.data || []).map((r: any) => {
        const id = Number(r.id ?? r.log_id ?? 0);
        const ts = String(r.ts ?? r.login_at ?? '');
        const ip = r.ip ?? r.ip_address ?? null;
        const username = r.username ?? null;
        const user_id = r.user_id ?? null;

        // ถ้าไม่มี action จาก API → เดาว่า success=true คือ LOGIN / false คือ LOGIN_FAIL
        const action =
          r.action ??
          (typeof r.success === 'boolean' ? (r.success ? 'LOGIN' : 'LOGIN_FAIL') : 'LOGIN');

        return { id, ts, ip, username, user_id, action };
      });

      setMetrics(mJson.data as UserMetrics);
      setAudit(rows);
    } catch (e: any) {
      setError(e?.message || 'โหลดข้อมูลล้มเหลว');
      setMetrics(null);
      setAudit([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top banner (แค่ปรับสี/สไตล์) */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-[#1E3A8A] via-[#1F4CB6] to-[#2563EB] text-white shadow-lg">
        {/* เส้นแสง */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-cyan-300/20 blur-xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-wide">ภาพรวมระบบ</h2>
            <p className="text-xs text-white/80">สรุปสถานะผู้ใช้และกิจกรรมล่าสุดในระบบของคุณ</p>
          </div>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs bg-white/10 px-2 py-1 rounded-md border border-white/20">{error}</span>}
            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm backdrop-blur hover:bg-white/20 transition"
              aria-label="Reload dashboard"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-90" fill="none">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" strokeWidth="1.5" />
                <path d="M21 5v6h-6" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              โหลดใหม่
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="ผู้ใช้ทั้งหมด"
          value={metrics?.total_users ?? 0}
          loading={loading}
          tone="slate"
        />
        <MetricCard
          title="เปิดใช้งาน (ACTIVE)"
          value={metrics?.active_users ?? 0}
          loading={loading}
          tone="emerald"
        />
        <MetricCard
          title="ระงับ (SUSPENDED)"
          value={metrics?.suspended_users ?? 0}
          loading={loading}
          tone="amber"
        />
      </div>

      {/* Role Breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-slate-50 to-white">
          <div className="text-sm font-semibold text-slate-900">ผู้ใช้ตามบทบาท</div>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="animate-pulse grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="h-12 bg-gray-100 rounded-lg" />
              <div className="h-12 bg-gray-100 rounded-lg" />
              <div className="h-12 bg-gray-100 rounded-lg" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <RolePill label="ADMIN" value={metrics?.by_role?.ADMIN ?? 0} color="blue" />
              <RolePill label="STAFF" value={metrics?.by_role?.STAFF ?? 0} color="sky" />
              <RolePill label="PROFESSOR" value={metrics?.by_role?.PROFESSOR ?? 0} color="indigo" />
            </div>
          )}
        </div>
      </div>

      {/* Recent Audit */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">ประวัติการเข้าใช้งาน (ล่าสุด)</div>
              <div className="text-xs text-gray-500">แสดง {audit.length} รายการล่าสุด</div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Dot color="emerald" />
                LOGIN
              </span>
              <span className="inline-flex items-center gap-1">
                <Dot color="sky" />
                LOGOUT
              </span>
              <span className="inline-flex items-center gap-1">
                <Dot color="amber" />
                LOGIN_FAIL
              </span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-slate-50 to-white">
              <tr className="text-gray-600">
                <th className="text-left px-3 py-2 font-medium">เวลา</th>
                <th className="text-left px-3 py-2 font-medium">ผู้ใช้</th>
                <th className="text-left px-3 py-2 font-medium">การกระทำ</th>
                <th className="text-left px-3 py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-3 py-3"><div className="h-3 bg-gray-100 rounded w-24" /></td>
                    <td className="px-3 py-3"><div className="h-3 bg-gray-100 rounded w-36" /></td>
                    <td className="px-3 py-3"><div className="h-3 bg-gray-100 rounded w-20" /></td>
                    <td className="px-3 py-3"><div className="h-3 bg-gray-100 rounded w-24" /></td>
                  </tr>
                ))
              ) : audit.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-gray-500">— ไม่มีข้อมูล —</td>
                </tr>
              ) : (
                audit.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 align-middle text-slate-700">{formatDate(r.ts)}</td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-slate-900">{r.username || '-'}</div>
                        <div className="text-xs text-gray-500">#{r.user_id ?? '-'}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${
                          r.action === 'LOGIN'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : r.action === 'LOGOUT'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <Dot color={r.action === 'LOGIN' ? 'emerald' : r.action === 'LOGOUT' ? 'sky' : 'amber'} />
                        {r.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-700">{r.ip || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================= Small UI ================= */
function MetricCard({
  title,
  value,
  loading,
  tone = 'slate',
}: {
  title: string;
  value: number;
  loading?: boolean;
  tone?: 'slate' | 'emerald' | 'amber';
}) {
  const toneMap: Record<string, { ring: string; chip: string; tint: string; icon: JSX.Element }> = {
    slate: {
      ring: 'ring-slate-200',
      chip: 'from-slate-50 to-white',
      tint: 'text-slate-700',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" className="text-slate-500" fill="none">
          <path d="M4 19h16M4 5h16M4 12h16" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
    },
    emerald: {
      ring: 'ring-emerald-200',
      chip: 'from-emerald-50 to-white',
      tint: 'text-emerald-700',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" className="text-emerald-600" fill="none">
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
    },
    amber: {
      ring: 'ring-amber-200',
      chip: 'from-amber-50 to-white',
      tint: 'text-amber-700',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" className="text-amber-600" fill="none">
          <path d="M12 8v5M12 17h.01" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
    },
  };

  const t = toneMap[tone];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-white ring-1 ${t.ring} shadow-sm`}
    >
      {/* gradient strip */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${t.chip}`} />
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">{title}</div>
          <div className="rounded-lg bg-white shadow-sm p-1.5">{t.icon}</div>
        </div>
        {loading ? (
          <div className="mt-3 h-7 bg-gray-100 rounded w-24 animate-pulse" />
        ) : (
          <div className={`mt-2 text-3xl font-semibold ${t.tint}`}>{value.toLocaleString()}</div>
        )}
      </div>
    </div>
  );
}

function RolePill({
  label,
  value,
  color,
}: {
  label: 'ADMIN' | 'STAFF' | 'PROFESSOR';
  value: number;
  color: 'blue' | 'sky' | 'indigo';
}) {
  const cls =
    color === 'blue'
      ? 'bg-blue-50 text-blue-800 border-blue-200'
      : color === 'sky'
      ? 'bg-sky-50 text-sky-800 border-sky-200'
      : 'bg-indigo-50 text-indigo-800 border-indigo-200';

  const icon =
    color === 'blue' ? (
      <svg width="16" height="16" viewBox="0 0 24 24" className="text-blue-600" fill="none">
        <path d="M16 14c2.761 0 5 2.239 5 5v2H3v-2c0-2.761 2.239-5 5-5h8zM12 12a5 5 0 100-10 5 5 0 000 10z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ) : color === 'sky' ? (
      <svg width="16" height="16" viewBox="0 0 24 24" className="text-sky-600" fill="none">
        <path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 8h8v8H8z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 24 24" className="text-indigo-600" fill="none">
        <path d="M12 2l7 7-7 7-7-7 7-7z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );

  return (
    <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${cls}`}>
      <div className="inline-flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </div>
      <div className="text-base font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}

function Dot({ color = 'slate' }: { color?: 'emerald' | 'sky' | 'amber' | 'slate' }) {
  const map: Record<string, string> = {
    emerald: 'bg-emerald-500',
    sky: 'bg-sky-500',
    amber: 'bg-amber-500',
    slate: 'bg-slate-400',
  };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${map[color]}`} />;
}

/* ================= Utils ================= */
function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch {
    return iso;
  }
}