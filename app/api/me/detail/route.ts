import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSessionUserId } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function GET(req: NextRequest) {
  try {
    const uid = await getSessionUserId(req);
    if (!uid) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('users')
      .select('user_id, username, first_name, last_name, email, phone, position, role, status, profile_image')
      .eq('user_id', uid)
      .single();

    if (error || !data) throw error || new Error('not found');

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'internal error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
