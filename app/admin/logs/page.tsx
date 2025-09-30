'use client';

import { useEffect, useMemo, useState } from 'react';

/* ============== Types ============== */
type AuditRow = {
  id: number;
  user_id: number | null;
  username: string | null;
  ts: string;                // ISO time
  success: boolean;
  ip: string | null;
  reason: string | null;
  user_agent?: string | null;
};

type Filters = {
  q: string;
  from: string;   // YYYY-MM-DD
  to: string;     // YYYY-MM-DD
  result: '' | 'success' | 'fail';
  ip: string;
};

/* ============== Helpers ============== */
async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const t = await res.text().catch(() => '');
    throw new Error(`non-JSON ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

function fmtDateTime(iso?: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  const dd = `${d.getDate()}`.padStart(2, '0');
  const mm = `${d.getMonth() + 1}`.padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mi = `${d.getMinutes()}`.padStart(2, '0');
  const ss = `${d.getSeconds()}`.padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
}

function chip(cls: string, text: string) {
  return (
    <span
      className={
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ' + cls
      }
    >
      {text}
    </span>
  );
}

/* ============== Page ============== */
export default function AdminLogsPage() {
  const [filters, setFilters] = useState<Filters>({
    q: '',
    from: '',
    to: '',
    result: '',
    ip: '',
  });

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // selection (รายละเอียดด้านขวา)
  const [active, setActive] = useState<AuditRow | null>(null);

  // paging (client-side)
  const [page, setPage] = useState(1);
  const pageSize = 12;

  async function load() {
    setLoading(true);
    setError(null);
    setActive(null);
    try {
      const p = new URLSearchParams();
      p.set('limit', '500'); // ดึงมา 500 รายการล่าสุดพอให้ค้นหาหน้านี้
      if (filters.q.trim()) p.set('q', filters.q.trim());
      if (filters.from) p.set('from', filters.from);
      if (filters.to) p.set('to', filters.to);
      if (filters.result) p.set('result', filters.result);
      if (filters.ip.trim()) p.set('ip', filters.ip.trim());

      const res = await fetch(`/api/admin/audit?${p.toString()}`, { cache: 'no-store' });
      const json = await safeJson(res);
      if (!res.ok || json?.ok === false) throw new Error(json?.message || 'load audit failed');
      const list: AuditRow[] = (json.data || []).map((r: any) => ({
        id: r.id ?? r.log_id ?? 0,
        user_id: r.user_id ?? null,
        username: r.username ?? null,
        ts: r.ts ?? r.login_at,
        success: !!r.success,
        ip: r.ip ?? r.ip_address ?? null,
        reason: r.reason ?? r.fail_reason ?? null,
        user_agent: r.user_agent ?? r.agent ?? null,
      }));
      setRows(list);
      setPage(1);
    } catch (e: any) {
      setError(e?.message || 'โหลดข้อมูลล้มเหลว');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- metrics ---- */
  const summary = useMemo(() => {
    const total = rows.length;
    let ok = 0;
    let fail = 0;
    const uniq = new Set<number | string>();
    rows.forEach((r) => {
      r.success ? ok++ : fail++;
      uniq.add(r.username || r.user_id || `ip:${r.ip}`);
    });
    return { total, ok, fail, uniqUsers: uniq.size };
  }, [rows]);

  /* ---- filtered (client re-filter ถ้าต้องการ layer เพิ่ม) ---- */
  const filtered = rows; // เราใช้ filter ที่ server แล้ว

  /* ---- page slice ---- */
  const start = (page - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  /* ---- export csv ---- */
  function exportCSV() {
    const cols = ['id', 'login_at', 'username', 'user_id', 'ip', 'success', 'reason', 'user_agent'];
    const header = cols.join(',');
    const lines = filtered.map((r) =>
      [
        r.id,
        fmtDateTime(r.ts),
        r.username ?? '',
        r.user_id ?? '',
        r.ip ?? '',
        r.success ? 'SUCCESS' : 'FAIL',
        (r.reason ?? '').replaceAll('"', '""'),
        (r.user_agent ?? '').replaceAll('"', '""'),
      ]
        .map((x) => {
          const s = String(x);
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(',')
    );
    const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'login_log.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---- reset ---- */
  function clearFilters() {
    setFilters({ q: '', from: '', to: '', result: '', ip: '' });
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4">
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-12 lg:col-span-4">
            <label className="text-xs text-gray-500">ผู้ใช้ / คีย์เวิร์ด</label>
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="เช่น somchai, IP, fail reason…"
              className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="col-span-6 sm:col-span-3 lg:col-span-2">
            <label className="text-xs text-gray-500">ช่วงวันที่ (จาก)</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2"
            />
          </div>

          <div className="col-span-6 sm:col-span-3 lg:col-span-2">
            <label className="text-xs text-gray-500">ช่วงวันที่ (ถึง)</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2"
            />
          </div>

          <div className="col-span-6 sm:col-span-3 lg:col-span-2">
            <label className="text-xs text-gray-500">ผลลัพธ์</label>
            <select
              value={filters.result}
              onChange={(e) => setFilters((f) => ({ ...f, result: e.target.value as any }))}
              className="w-full border rounded-xl px-3 py-2"
            >
              <option value="">ทั้งหมด</option>
              <option value="success">สำเร็จ (SUCCESS)</option>
              <option value="fail">ล้มเหลว (FAIL)</option>
            </select>
          </div>

          <div className="col-span-6 sm:col-span-3 lg:col-span-2">
            <label className="text-xs text-gray-500">IP Address</label>
            <input
              value={filters.ip}
              onChange={(e) => setFilters((f) => ({ ...f, ip: e.target.value }))}
              placeholder="เช่น 10.0.1.25"
              className="w-full border rounded-xl px-3 py-2"
            />
          </div>

          <div className="col-span-12 lg:col-span-12 flex gap-2 justify-end">
            <button
              onClick={load}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
            >
              ค้นหาข้อมูล
            </button>
            <button
              onClick={() => {
                clearFilters();
                setTimeout(load, 0);
              }}
              className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200"
            >
              ล้าง
            </button>
          </div>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4">
          <MiniStat title="ทั้งหมด" value={summary.total} tone="slate" />
          <MiniStat title="สำเร็จ (SUCCESS)" value={summary.ok} tone="emerald" />
          <MiniStat title="ล้มเหลว (FAIL)" value={summary.fail} tone="rose" />
          <MiniStat title="ผู้ใช้ที่เกี่ยวข้อง (Unique)" value={summary.uniqUsers} tone="indigo" />
        </div>
      </div>

      {/* Table + Side detail */}
      <div className="grid grid-cols-12 gap-4">
        {/* left: table */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-9">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900">ประวัติการเข้าใช้งาน</div>
                <div className="text-xs text-gray-500">แสดง {filtered.length} รายการ (ล่าสุด)</div>
              </div>
              <div className="flex gap-2">
                {error && <span className="text-sm text-rose-600">{error}</span>}
                <button
                  onClick={exportCSV}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-gray-600">
                    <th className="text-left px-3 py-2 font-medium w-[160px]">วันเวลา</th>
                    <th className="text-left px-3 py-2 font-medium">ผู้ใช้</th>
                    <th className="text-left px-3 py-2 font-medium w-[140px]">IP Address</th>
                    <th className="text-left px-3 py-2 font-medium w-[100px]">ผลลัพธ์</th>
                    <th className="text-left px-3 py-2 font-medium">เหตุผลล้มเหลว</th>
                    <th className="text-left px-3 py-2 font-medium w-[160px]">User Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-3 py-3"><div className="h-3 bg-gray-100 rounded w-28" /></td>
                        <td className="px-3 py-3"><div className="h-3 bg-gray-100 rounded w-40" /></td>
                        <td className="px-3 py-3"><div className="h-3 bg-gray-100 rounded w-24" /></td>
                        <td className="px-3 py-3"><div className="h-5 bg-gray-100 rounded w-16" /></td>
                        <td className="px-3 py-3"><div className="h-3 bg-gray-100 rounded w-56" /></td>
                        <td className="px-3 py-3"><div className="h-3 bg-gray-100 rounded w-40" /></td>
                      </tr>
                    ))
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-gray-500">
                        — ไม่พบข้อมูล —
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((r) => (
                      <tr
                        key={r.id}
                        className={`hover:bg-gray-50 cursor-pointer ${active?.id === r.id ? 'bg-blue-50/40' : ''}`}
                        onClick={() => setActive(r)}
                        title="คลิกเพื่อดูรายละเอียด"
                      >
                        <td className="px-3 py-2 align-middle">{fmtDateTime(r.ts)}</td>
                        <td className="px-3 py-2 align-middle">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{r.username || 'unknown'}</span>
                            {r.user_id && <span className="text-xs text-gray-500">#{r.user_id}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-middle">{r.ip || '-'}</td>
                        <td className="px-3 py-2 align-middle">
                          {r.success
                            ? chip('bg-emerald-50 text-emerald-700 border-emerald-200', 'สำเร็จ')
                            : chip('bg-rose-50 text-rose-700 border-rose-200', 'ล้มเหลว')}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {r.success ? <span className="text-gray-400">—</span> : r.reason || '-'}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <span className="text-gray-600 truncate block max-w-[240px]" title={r.user_agent || ''}>
                            {r.user_agent || 'Unknown Agent'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* footer paging */}
            <div className="flex items-center justify-between px-4 py-3 text-sm text-gray-600 border-t">
              <div>
                แสดง {filtered.length === 0 ? 0 : start + 1}-{Math.min(start + pageSize, filtered.length)} จาก {filtered.length} รายการ
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-40"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ก่อนหน้า
                </button>
                <button
                  className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-40"
                  disabled={start + pageSize >= filtered.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  หน้าถัดไป
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* right: detail */}
        <div className="col-span-12 lg:col-span-4 xl:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 sticky top-24">
            <div className="text-sm font-medium text-slate-900">รายละเอียดเหตุการณ์</div>

            {!active ? (
              <div className="text-sm text-gray-500 mt-2">คลิกแถวในตารางเพื่อดูรายละเอียด</div>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                <KV label="วันเวลา" value={fmtDateTime(active.ts)} />
                <KV label="ผู้ใช้" value={`${active.username || 'unknown'} ${active.user_id ? `(#${active.user_id})` : ''}`} />
                <KV
                  label="ผลลัพธ์"
                  value={
                    active.success
                      ? 'SUCCESS — ลงชื่อเข้าใช้สำเร็จ'
                      : 'FAIL — ลงชื่อเข้าใช้ล้มเหลว'
                  }
                  tone={active.success ? 'ok' : 'bad'}
                />
                <KV label="IP" value={active.ip || '-'} />
                <KV label="User Agent" value={active.user_agent || 'Unknown Agent'} />
                {!active.success && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">รายละเอียดเหตุผล</div>
                    <div className="text-sm rounded-lg border bg-rose-50 text-rose-700 px-3 py-2">
                      {active.reason || '—'}
                    </div>
                  </div>
                )}
                <div className="pt-2">
                  <button
                    onClick={() => setActive(null)}
                    className="w-full px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm"
                  >
                    ปิดรายละเอียด
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============== Small UI ============== */

function MiniStat({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: 'slate' | 'emerald' | 'rose' | 'indigo';
}) {
  const map: Record<typeof tone, string> = {
    slate: 'bg-slate-50 text-slate-800 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    rose: 'bg-rose-50 text-rose-800 border-rose-200',
    indigo: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  } as any;

  return (
    <div className={`rounded-xl border p-3 ${map[tone]}`}>
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-xl font-semibold mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

function KV({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'bad';
}) {
  const color =
    tone === 'ok'
      ? 'text-emerald-700'
      : tone === 'bad'
      ? 'text-rose-700'
      : 'text-slate-900';
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm ${color}`}>{value}</div>
    </div>
  );
}