// app/api/me/change-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { getSessionUserId } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // ใช้ฝั่ง server เท่านั้น
);

// เลือก policy ของคุณเอง: อย่างน้อย 8 ตัวอักษร
function passwordWeak(pw: string) {
  return !pw || pw.length < 8;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { current_password, new_password, confirm_password } = await req.json();

    if (!current_password || !new_password || !confirm_password) {
      return NextResponse.json({ ok: false, message: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }
    if (new_password !== confirm_password) {
      return NextResponse.json({ ok: false, message: 'รหัสผ่านใหม่ไม่ตรงกัน' }, { status: 400 });
    }
    if (passwordWeak(new_password)) {
      return NextResponse.json({ ok: false, message: 'รหัสผ่านใหม่ควรมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
    }

    // อ่าน hash เดิม
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, password_hash')
      .eq('user_id', userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ ok: false, message: 'ไม่พบผู้ใช้' }, { status: 404 });
    }

    // ตรวจรหัสผ่านเดิม
    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ ok: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' }, { status: 400 });
    }

    // อัปเดตเป็น hash ใหม่
    const newHash = await bcrypt.hash(new_password, 10);
    const { error: uerr } = await supabase
      .from('users')
      .update({ password_hash: newHash })
      .eq('user_id', userId);

    if (uerr) throw uerr;

    return NextResponse.json({ ok: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อย' });
  } catch (e: any) {
    console.error('[change-password] error:', e);
    return NextResponse.json({ ok: false, message: e?.message || 'Internal error' }, { status: 500 });
  }
}
