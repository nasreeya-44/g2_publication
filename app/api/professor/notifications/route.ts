// app/api/professor/notifications/route.ts
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

export async function GET(req: NextRequest) {
  const user = await me(req);
  if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'PROFESSOR' && user.role !== 'ADMIN')
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const onlyUnread = url.searchParams.get('unread') === '1';
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 50)));

  try {
    // ดึง noti ของ user
    let q = supabase
      .from('notification')
      .select(`
        noti_id, pub_id, event_type, status, comment, created_at, is_read, read_at,
        publication:pub_id(pub_name, venue_name, year, updated_at)
      `)
      .eq('user_id', user.user_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (onlyUnread) q = q.eq('is_read', false);

    const { data, error } = await q;
    if (error) throw error;

    const items = (data || []).map((r: any) => ({
      noti_id: r.noti_id as number,
      pub_id: r.pub_id as number,
      title: r.publication?.pub_name || `#${r.pub_id}`,
      venue_name: r.publication?.venue_name ?? null,
      year: r.publication?.year ?? null,
      status: r.status ?? r.event_type ?? null,
      latest_comment: r.comment ?? null,
      updated_at: r.created_at,
      is_unread: !r.is_read,
    }));

    const unreadCount = (data || []).filter((x: any) => !x.is_read).length;

    return NextResponse.json({ ok: true, items, unreadCount });
  } catch (e: any) {
    console.error('notifications list error:', e?.message || e);
    return NextResponse.json({ ok: false, message: e?.message || 'internal error' }, { status: 500 });
  }
}
