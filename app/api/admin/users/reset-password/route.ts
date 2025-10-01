// app/api/admin/users/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

// POST /api/admin/users/reset-password
// body: { user_id: number, new_password: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user_id = Number(body?.user_id);
    const new_password: string | undefined = body?.new_password;

    if (!Number.isFinite(user_id)) {
      return NextResponse.json({ ok: false, message: 'invalid user_id' }, { status: 400 });
    }
    if (!new_password) {
      return NextResponse.json({ ok: false, message: 'new_password is required' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(new_password, 10);

    const { data, error } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('user_id', user_id)
      .select('user_id')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message || 'reset password failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';