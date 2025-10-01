// app/api/professor/publications/[id]/status-history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

type UserPayload = {
  user_id: number;
  username: string;
  role: 'ADMIN' | 'STAFF' | 'PROFESSOR';
};

async function getUser(req: NextRequest): Promise<UserPayload | null> {
  const token = req.cookies.get('app_session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.SESSION_SECRET!)
    );
    return payload as UserPayload;
  } catch {
    return null;
  }
}

const bad = (m: string, s = 400) => NextResponse.json({ ok: false, message: m }, { status: s });
const canView = (r?: string) => r === 'PROFESSOR' || r === 'STAFF' || r === 'ADMIN';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getUser(req);
  if (!me) return bad('Unauthorized', 401);
  if (!canView(me.role)) return bad('Forbidden', 403);

  const pubId = Number(params.id);
  if (!Number.isFinite(pubId)) return bad('Invalid id');

  try {
    // ให้สอดคล้องกับสคีมา:
    // primary key (pub_id, changed_at)
    // fields: user_id, pub_id, changed_at, changed_by, note, status
    // FK changed_by -> users(user_id)
    const { data, error } = await supabase
      .from('publication_status_history')
      .select(`
        pub_id,
        changed_at,
        status,
        note,
        user_id,
        changed_by,
        user:changed_by (
          user_id,
          first_name,
          last_name,
          username,
          role
        )
      `)
      .eq('pub_id', pubId)
      .order('changed_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (e: any) {
    console.error('status-history error:', e?.message || e);
    return bad(e?.message || 'internal error', 500);
  }
}

export const dynamic = 'force-dynamic';
