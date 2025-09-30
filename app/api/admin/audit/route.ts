// app/api/admin/audit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '../users/util';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

// -- helpers --
function toInt(v: string | null, def = 500, min = 1, max = 2000) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(Math.floor(n), min), max);
}
function dayStartISO(yyyy_mm_dd: string) {
  const d = new Date(yyyy_mm_dd + 'T00:00:00.000Z');
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function nextDayISO(yyyy_mm_dd: string) {
  const d = new Date(yyyy_mm_dd + 'T00:00:00.000Z');
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString(); // ใช้ lt(nextDay) เพื่อรวมทั้งวัน
}

export async function GET(req: NextRequest) {
  // ตรวจสิทธิ์ ADMIN
  await assertAdmin(req);

  const { searchParams } = new URL(req.url);

  // ฟิลเตอร์ที่รองรับ
  const q = (searchParams.get('q') || '').trim();              // ค้นหากว้าง: username / ip / reason
  const from = (searchParams.get('from') || '').trim();        // YYYY-MM-DD
  const to = (searchParams.get('to') || '').trim();            // YYYY-MM-DD
  const result = (searchParams.get('result') || '').trim().toLowerCase(); // success|fail|''
  const ipOnly = (searchParams.get('ip') || '').trim();        // เฉพาะ IP
  const limit = toInt(searchParams.get('limit'), 500, 1, 2000);

  // query หลัก
  let q1 = supabase
    .from('login_log')
    .select(
      `
        log_id,
        user_id,
        login_at,
        success,
        ip_address,
        fail_reason,
        user:users!login_log_user_id_fkey(username)
      `
    )
    .order('login_at', { ascending: false })
    .limit(limit);

  // ฟิลเตอร์ from/to
  if (from) {
    const iso = dayStartISO(from);
    if (iso) q1 = q1.gte('login_at', iso);
  }
  if (to) {
    const iso = nextDayISO(to);
    if (iso) q1 = q1.lt('login_at', iso);
  }

  // ฟิลเตอร์ result
  if (result === 'success') q1 = q1.eq('success', true);
  else if (result === 'fail') q1 = q1.eq('success', false);

  // ฟิลเตอร์ ipOnly
  if (ipOnly) q1 = q1.ilike('ip_address', `%${ipOnly}%`);

  // ฟิลเตอร์ค้นหากว้าง q (username/ip/reason)
  if (q) {
    q1 = q1.or(
      [
        `user.username.ilike.%${q}%`,
        `ip_address.ilike.%${q}%`,
        `fail_reason.ilike.%${q}%`,
      ].join(',')
    );
  }

  const { data, error } = await q1;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  // Map ข้อมูล -> โครงสร้างที่รองรับทั้งของเดิมและของใหม่
  const rows = (data || []).map((r: any) => ({
    // ---- ของเดิม ----
    id: r.log_id,
    ts: r.login_at,
    ip: r.ip_address,
    username: r.user?.username ?? null,
    user_id: r.user_id ?? null,
    action: r.success ? 'LOGIN' : 'LOGIN_FAIL', // คง key เดิมให้

    // ---- เพิ่มเติม (ของใหม่) ----
    success: !!r.success,
    reason: r.fail_reason ?? null,
  }));

  // NOTE: คงรูปแบบ response เดิม (ไม่มี ok) เพื่อให้หน้าเก่าทำงานต่อได้
  return NextResponse.json({ data: rows });
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;