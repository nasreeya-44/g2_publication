// app/api/professor/people/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

async function getUserFromCookie(req: NextRequest) {
  const token = req.cookies.get('app_session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.SESSION_SECRET!)
    );
    return payload as {
      user_id: number;
      username: string;
      role: 'ADMIN' | 'STAFF' | 'PROFESSOR';
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const me = await getUserFromCookie(req);
    if (!me) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    if (!q) return NextResponse.json({ ok: true, data: [] });

    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 20), 1), 50);

    // ✅ เลือกเฉพาะคอลัมน์ที่มีจริงในตาราง person
    const { data, error } = await supabase
      .from('person')
      .select('person_id, full_name, email')
      .ilike('full_name', `%${q}%`)
      .order('full_name', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      data: (data || []).map((r) => ({
        person_id: r.person_id,
        full_name: r.full_name,
        email: r.email ?? null, // ส่งอีเมลกลับไปเพื่อให้หน้า new auto-fill ได้
      })),
    });
  } catch (e: any) {
    console.error('people suggest error:', e?.message || e);
    return NextResponse.json(
      { ok: false, message: e?.message || 'internal error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
