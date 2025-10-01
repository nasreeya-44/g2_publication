// app/api/professor/notifications/read/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

type UserPayload = { user_id: number; username: string; role: 'ADMIN'|'STAFF'|'PROFESSOR' };

async function me(req: NextRequest): Promise<UserPayload | null> {
  const token = req.cookies.get('app_session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET!));
    return payload as UserPayload;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await me(req);
  if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'PROFESSOR' && user.role !== 'ADMIN')
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const noti_id = body?.noti_id ? Number(body.noti_id) : null;
    const pub_id  = body?.pub_id  ? Number(body.pub_id)  : null;

    if (!Number.isFinite(noti_id) && !Number.isFinite(pub_id)) {
      return NextResponse.json({ ok: false, message: 'require noti_id or pub_id' }, { status: 400 });
    }

    // มาร์คอ่าน
    if (Number.isFinite(noti_id)) {
      const { error } = await supabase
        .from('notification')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('noti_id', noti_id)
        .eq('user_id', user.user_id);
      if (error) throw error;
    } else if (Number.isFinite(pub_id)) {
      const { error } = await supabase
        .from('notification')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('pub_id', pub_id)
        .eq('user_id', user.user_id);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('notifications read error:', e?.message || e);
    return NextResponse.json({ ok: false, message: e?.message || 'internal error' }, { status: 500 });
  }
}
