import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // ใช้ service role
);

export async function POST(req: NextRequest) {
  try {
    const { user_id, current_password, new_password } = await req.json();

    if (!user_id || !current_password || !new_password) {
      return NextResponse.json({ ok: false, message: 'missing fields' }, { status: 400 });
    }
    if (typeof new_password !== 'string' || new_password.length < 6) {
      return NextResponse.json({ ok: false, message: 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
    }

    // ดึง password_hash ของผู้ใช้
    const { data: user, error: qErr } = await supabase
      .from('users')
      .select('user_id, password_hash')
      .eq('user_id', user_id)
      .single();

    if (qErr || !user) {
      return NextResponse.json({ ok: false, message: 'ไม่พบผู้ใช้' }, { status: 404 });
    }

    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ ok: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' }, { status: 400 });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    const { error: upErr } = await supabase
      .from('users')
      .update({ password_hash: hashed })
      .eq('user_id', user_id);

    if (upErr) {
      return NextResponse.json({ ok: false, message: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';