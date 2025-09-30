// app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server-only key
);

const SESSION_SECRET = process.env.SESSION_SECRET!;
if (!SESSION_SECRET) {
  console.warn('[login] SESSION_SECRET not set');
}

/* ----------------- helpers ----------------- */
function getClientIP(req: NextRequest) {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  // @ts-ignore
  return (req as any).ip || req.headers.get('x-real-ip') || null;
}

async function signSession(payload: Record<string, any>) {
  const key = new TextEncoder().encode(SESSION_SECRET);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 7 วัน
    .sign(key);
}

async function logLogin(params: {
  user_id: number | null;
  success: boolean;
  ip?: string | null;
  reason?: string | null;
}) {
  try {
    await supabase.from('login_log').insert({
      user_id: params.user_id ?? null,
      success: params.success,
      ip_address: params.ip ?? null,
      fail_reason: params.reason ?? null,
    });
  } catch (e) {
    console.error('[login] logLogin error:', e);
  }
}

function redirectForRole(role: string) {
  switch (String(role).toUpperCase()) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'STAFF':
      return '/staff/dashboard';
    case 'PROFESSOR':
      return '/professor/dashboard';
    default:
      return '/';
  }
}

/* ----------------- handler ----------------- */
export async function POST(req: NextRequest) {
  try {
    const { username, password } = (await req.json()) as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' },
        { status: 400 }
      );
    }

    const selectCols =
      'user_id, username, email, password_hash, role, status, first_name, last_name, profile_image';

    // หา user จาก username ก่อน ถ้าไม่เจอค่อยลองหาเป็น email
    let { data: user } = await supabase
      .from('users')
      .select(selectCols)
      .eq('username', username)
      .maybeSingle();

    if (!user) {
      const { data: byEmail } = await supabase
        .from('users')
        .select(selectCols)
        .eq('email', username)
        .maybeSingle();
      user = byEmail || null;
    }

    const ip = getClientIP(req);

    if (!user) {
      await logLogin({ user_id: null, success: false, ip, reason: 'User not found' });
      return NextResponse.json(
        { ok: false, message: 'ไม่พบผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      );
    }

    if (String(user.status).toUpperCase() === 'SUSPENDED') {
      await logLogin({ user_id: user.user_id, success: false, ip, reason: 'Account suspended' });
      return NextResponse.json({ ok: false, message: 'บัญชีถูกระงับการใช้งาน' }, { status: 403 });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      await logLogin({ user_id: user.user_id, success: false, ip, reason: 'Invalid password' });
      return NextResponse.json(
        { ok: false, message: 'ไม่พบผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      );
    }

    // สำเร็จ → สร้าง session token
    const token = await signSession({
      user_id: user.user_id,
      username: user.username,
      role: user.role,
    });

    await logLogin({ user_id: user.user_id, success: true, ip, reason: null });

    // เลือกเส้นทางตาม role
    const redirect = redirectForRole(user.role);

    const res = NextResponse.json({
      ok: true,
      redirect,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_image: user.profile_image,
      },
    });

    // ตั้งคุกกี้ session
    res.cookies.set('app_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (e: any) {
    console.error('[login] error:', e);
    return NextResponse.json({ ok: false, message: e?.message || 'Internal error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
