import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSessionUserId } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function PATCH(req: NextRequest) {
  try {
    const uid = await getSessionUserId(req);
    if (!uid) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const allow = ['first_name', 'last_name', 'username', 'email', 'phone', 'position'] as const;

    const payload: Record<string, any> = {};
    for (const k of allow) if (k in body) payload[k] = body[k];

    if (Object.keys(payload).length === 0)
      return NextResponse.json({ ok: false, message: 'no fields to update' }, { status: 400 });

    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('user_id', uid)
      .select('user_id, username, first_name, last_name, email, phone, position, role, status, profile_image')
      .single();

    if (error || !data) throw error || new Error('update failed');

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'internal error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
