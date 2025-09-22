// app/api/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { createClient } from '@supabase/supabase-js';

const SESSION_SECRET = process.env.SESSION_SECRET!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server-only key
);

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('app_session')?.value;
    if (!token) {
      return NextResponse.json({ ok: false, message: 'no session' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(SESSION_SECRET));
    const user_id = (payload as any)?.user_id as number | undefined;
    if (!user_id) {
      return NextResponse.json({ ok: false, message: 'invalid session' }, { status: 401 });
    }

    // ดึงข้อมูลผู้ใช้ล่าสุดจาก DB
    const { data: u, error } = await supabase
      .from('users')
      .select('user_id, username, first_name, last_name, role, status, profile_image, email')
      .eq('user_id', user_id)
      .maybeSingle();

    if (error) throw error;
    if (!u) return NextResponse.json({ ok: false, message: 'user not found' }, { status: 404 });

    return NextResponse.json({
      ok: true,
      data: {
        user_id: u.user_id,
        username: u.username,
        first_name: u.first_name,
        last_name: u.last_name,
        role: u.role,
        status: u.status,
        profile_image: u.profile_image,
        email: u.email ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'unauthorized' }, { status: 401 });
  }
}

export const dynamic = 'force-dynamic';