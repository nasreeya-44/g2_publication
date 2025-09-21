import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '../users/util';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function GET(req: NextRequest) {
  await assertAdmin(req);
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();

  let q1 = supabase
    .from('login_log')
    .select('log_id, user_id, login_at, success, ip_address, fail_reason, user:users!login_log_user_id_fkey(username)')
    .order('login_at', { ascending: false })
    .limit(500); // ป้องกัน response ใหญ่

  if (q) {
    // กรอง username / ip
    q1 = q1.or(`user.username.ilike.%${q}%,ip_address.ilike.%${q}%`);
  }

  const { data, error } = await q1;
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const rows = (data || []).map((r: any) => ({
    log_id: r.log_id,
    user_id: r.user_id,
    username: r.user?.username ?? null,
    login_at: r.login_at,
    success: r.success,
    ip_address: r.ip_address,
    fail_reason: r.fail_reason,
  }));

  return NextResponse.json({ data: rows });
}

export const dynamic = 'force-dynamic';