'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/* ==== Types ==== */
type LoginResponse =
  | { ok: true; redirect?: string }
  | { success: true; redirect?: string }
  | { ok?: false; success?: false; message?: string; error?: string };

type AdminContact = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  avatar: string | null;
};

/* ==== Helpers ==== */
async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const t = await res.text().catch(() => '');
    throw new Error(`API non-JSON (${res.status}): ${t.slice(0, 200)}`);
  }
  return res.json();
}

/* ==== Components ==== */
function Avatar({ url, size = 36, alt = 'avatar' }: { url?: string | null; size?: number; alt?: string }) {
  const s = `${size}px`;
  return (
    <div
      className="rounded-full bg-gray-200 overflow-hidden flex items-center justify-center shrink-0 border border-gray-200"
      style={{ width: s, height: s }}
    >
      {url ? (
        <img src={url} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <svg viewBox="0 0 24 24" width={Math.floor(size * 0.55)} height={Math.floor(size * 0.55)} className="text-gray-400">
          <path fill="currentColor" d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5.33 0-8 2.667-8 6v1h16v-1c0-3.333-2.67-6-8-6z" />
        </svg>
      )}
    </div>
  );
}

function IconMail(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14" {...props}>
      <path d="M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconPhone(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14" {...props}>
      <path d="M4 5a2 2 0 012-2h2l2 4-2 1c.5 1.8 2.2 3.5 4 4l1-2 4 2v2a2 2 0 01-2 2h-1C9.82 16 8 14.18 6 12S2 8.18 2 5.99V5z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconChevronDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16" {...props}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconChevronUp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16" {...props}>
      <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ==== Page ==== */
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Admins
  const [admins, setAdmins] = useState<AdminContact[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [loadAdminsErr, setLoadAdminsErr] = useState<string | null>(null);

  // Toggle show admins (hidden until user clicks "ลืมรหัสผ่าน?")
  const [showAdmins, setShowAdmins] = useState(false);
  const [expandAdmins, setExpandAdmins] = useState(false);
  const MAX_SHOW = 2;
  const visibleAdmins = expandAdmins ? admins : admins.slice(0, MAX_SHOW);
  const hiddenCount = Math.max(0, admins.length - MAX_SHOW);

  useEffect(() => {
    if (!showAdmins) return;
    (async () => {
      setLoadingAdmins(true);
      try {
        const res = await fetch('/api/public/admin-contacts', { cache: 'no-store' });
        const json = await safeJson(res);
        if (!res.ok || json?.ok === false) throw new Error(json?.message || 'load admin contacts failed');
        setAdmins(json.data as AdminContact[]);
      } catch (e: any) {
        setLoadAdminsErr(e?.message || 'โหลดข้อมูลผู้ดูแลล้มเหลว');
      } finally {
        setLoadingAdmins(false);
      }
    })();
  }, [showAdmins]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await safeJson(res);
      if (!res.ok || !(json as any)?.ok && !(json as any)?.success) {
        throw new Error((json as any)?.message || (json as any)?.error || 'เข้าสู่ระบบไม่สำเร็จ');
      }
      router.replace((json as any)?.redirect || '/admin/dashboard');
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative">
      <div className="absolute right-20 top-20 h-72 w-72 bg-blue-500/20 rounded-full blur-3xl" />
      <div className="absolute left-10 bottom-10 h-64 w-64 bg-indigo-500/10 rounded-full blur-2xl" />

      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 border border-slate-100">
        <h1 className="text-sm font-medium text-slate-500 mb-1">ระบบจัดการผลงานตีพิมพ์</h1>
        <h2 className="text-2xl font-bold text-slate-800 mb-1">เข้าสู่ระบบ</h2>
        <p className="text-sm text-gray-500 mb-6">โปรดกรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าใช้งานระบบ</p>

        {error && <div className="mb-4 p-3 rounded-lg bg-rose-50 text-rose-600 text-sm border border-rose-200">{error}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">EMAIL / USERNAME</label>
            <input
              type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="eg. somchai or name@example.com"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoFocus autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">PASSWORD</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        {/* ลืมรหัสผ่าน → กดเพื่อดู Admin */}
        <div className="mt-4 text-sm text-gray-500">
          <button
            onClick={() => setShowAdmins(!showAdmins)}
            className="hover:text-gray-700 underline"
          >
            ลืมรหัสผ่าน?
          </button>
        </div>

        {showAdmins && (
          <div className="mt-5 transition">
            <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-800 px-4 py-3">
              <div className="font-semibold text-[14px]">ติดต่อผู้ดูแลระบบ</div>
              {loadingAdmins ? (
                <div className="mt-3">กำลังโหลด...</div>
              ) : loadAdminsErr ? (
                <div className="mt-3 text-amber-700 text-[13px]">{loadAdminsErr}</div>
              ) : admins.length === 0 ? (
                <div className="mt-3 text-amber-700 text-[13px]">ไม่มีผู้ดูแลระบบที่พร้อมติดต่อ</div>
              ) : (
                <>
                  <ul className="mt-3 space-y-3">
                    {visibleAdmins.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 text-[13px]">
                        <Avatar url={a.avatar} size={36} alt={a.name} />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 truncate">
                            {a.name}{a.position ? <span className="text-gray-500"> — {a.position}</span> : null}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-0.5">
                            {a.email && (
                              <span className="inline-flex items-center gap-1 text-gray-700">
                                <IconMail className="text-gray-500" />
                                <a href={`mailto:${a.email}`} className="underline hover:text-slate-900">{a.email}</a>
                              </span>
                            )}
                            {a.phone && (
                              <span className="inline-flex items-center gap-1 text-gray-700">
                                <IconPhone className="text-gray-500" />
                                <a href={`tel:${a.phone}`} className="hover:text-slate-900">{a.phone}</a>
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {hiddenCount > 0 && !expandAdmins && (
                    <button onClick={() => setExpandAdmins(true)} className="mt-3 inline-flex items-center gap-1 text-[13px] px-3 py-1 rounded border border-amber-200 bg-white hover:bg-gray-50">
                      ดูเพิ่มเติม ({hiddenCount}) <IconChevronDown />
                    </button>
                  )}
                  {expandAdmins && admins.length > MAX_SHOW && (
                    <button onClick={() => setExpandAdmins(false)} className="mt-3 inline-flex items-center gap-1 text-[13px] px-3 py-1 rounded border border-amber-200 bg-white hover:bg-gray-50">
                      แสดงน้อยลง <IconChevronUp />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-6">© COMSCI PSU HAT-YAI — สำหรับบุคลากรภายใน</p>
      </div>
    </div>
  );
}