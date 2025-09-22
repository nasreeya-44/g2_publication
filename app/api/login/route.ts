// app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;         // public ok
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;   // **ไม่ใช่ NEXT_PUBLIC**
const SESSION_SECRET = process.env.SESSION_SECRET!;                 // random string ยาว ๆ

// Service role ใช้เฉพาะฝั่ง server เท่านั้น
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// JWT helper
async function signSession(payload: Record<string, any>) {
  const secret = new TextEncoder().encode(SESSION_SECRET);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')  // อายุคุกกี้ 7 วัน
    .sign(secret);
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { message: 'กรุณากรอก username และ password' },
        { status: 400 },
      );
    }

    // อ่านจากตาราง public.user (service role จะไม่ติด RLS — โอเคสำหรับ login เท่านั้น)
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, username, role, password_hash, status') // ถ้ามี status
      .eq('username', username)
      .single();

    if (error || !user) {
      return NextResponse.json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }
    if (user.status && user.status !== 'ACTIVE') {
      return NextResponse.json({ message: 'บัญชีถูกระงับการใช้งาน' }, { status: 403 });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    const safeUser = { user_id: user.user_id, username: user.username, role: user.role };

    // สร้าง JWT แล้วเก็บใน HttpOnly cookie
    const token = await signSession(safeUser);
    const res = NextResponse.json({ message: 'เข้าสู่ระบบสำเร็จ', user: safeUser });

    res.cookies.set({
      name: 'app_session',
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { message: err.message || 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' },
      { status: 500 },
    );
  }
}
