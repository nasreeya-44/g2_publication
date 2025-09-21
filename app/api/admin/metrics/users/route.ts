// app/api/admin/metrics/users/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(URL, SERVICE!, { auth: { persistSession: false } });

export async function GET() {
  try {
    const countUsers = async (filters?: Record<string, any>) => {
      let q = supabase.from('users').select('*', { count: 'exact', head: true });
      if (filters) {
        for (const [k, v] of Object.entries(filters)) {
          q = q.eq(k, v as any);
        }
      }
      const { error, count } = await q;
      if (error) throw error;
      return count ?? 0;
    };

    const [total, active, suspended, admin, staff, prof] = await Promise.all([
      countUsers(),
      countUsers({ status: 'ACTIVE' }),
      countUsers({ status: 'SUSPENDED' }),
      countUsers({ role: 'ADMIN' }),
      countUsers({ role: 'STAFF' }),
      countUsers({ role: 'PROFESSOR' }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        total_users: total,
        active_users: active,
        suspended_users: suspended,
        by_role: { ADMIN: admin, STAFF: staff, PROFESSOR: prof },
      },
    });
  } catch (e: any) {
    console.error('[metrics/users] error:', e);
    return NextResponse.json(
      { ok: false, message: e?.message || 'metrics failed' },
      { status: 500 }
    );
  }
}