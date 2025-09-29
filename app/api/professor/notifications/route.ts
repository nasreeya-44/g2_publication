// app/api/professor/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

type UserPayload = { user_id: number; username: string; role: 'ADMIN'|'STAFF'|'PROFESSOR' };

async function getUserFromCookie(req: NextRequest): Promise<UserPayload | null> {
  const token = req.cookies.get('app_session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET!));
    return payload as UserPayload;
  } catch {
    return null;
  }
}

const bad = (m: string, s = 400) => NextResponse.json({ ok: false, message: m }, { status: s });

/**
 * ส่งกลับรายการ “ผลงานที่ต้องแก้ไข” ของอาจารย์ผู้ใช้ปัจจุบัน
 * เกณฑ์: เป็น LEAD ของงานนั้น และสถานะปัจจุบัน = needs_revision
 * แนบคอมเมนต์ล่าสุดจาก review_action (ถ้ามี)
 */
export async function GET(req: NextRequest) {
  const me = await getUserFromCookie(req);
  if (!me) return bad('Unauthorized', 401);
  if (me.role !== 'PROFESSOR' && me.role !== 'ADMIN') return bad('Forbidden', 403);

  try {
    // 1) ดึง person_id ของ user นี้
    const { data: persons, error: pErr } = await supabase
      .from('person')
      .select('person_id')
      .eq('user_id', me.user_id);
    if (pErr) throw pErr;

    const myPersonIds = (persons || []).map((x: any) => x.person_id);
    if (!myPersonIds.length) {
      return NextResponse.json({ ok: true, count: 0, items: [] });
    }

    // 2) pub_id ที่เราเป็น LEAD
    const { data: myLead, error: leadErr } = await supabase
      .from('publication_person')
      .select('pub_id, role')
      .in('person_id', myPersonIds);
    if (leadErr) throw leadErr;

    const leadPubIds = (myLead || [])
      .filter((r: any) => String(r.role || '').toUpperCase() === 'LEAD')
      .map((r: any) => r.pub_id);

    if (!leadPubIds.length) {
      return NextResponse.json({ ok: true, count: 0, items: [] });
    }

    // 3) รายการงานที่ต้องแก้ไข (needs_revision)
    const { data: pubs, error: pubErr } = await supabase
      .from('publication')
      .select('pub_id, pub_name, venue_name, status, updated_at, year')
      .in('pub_id', leadPubIds)
      .eq('status', 'needs_revision')
      .order('updated_at', { ascending: false });
    if (pubErr) throw pubErr;

    if (!pubs?.length) {
      return NextResponse.json({ ok: true, count: 0, items: [] });
    }

    const pubIds = pubs.map((p: any) => p.pub_id);

    // 4) คอมเมนต์ล่าสุดจากเจ้าหน้าที่ (review_action)
    //    ดึงมารอบเดียวแล้วจับคู่เอง
    const { data: reviews } = await supabase
      .from('review_action')
      .select('pub_id, action, comment, reviewer_user_id')
      .in('pub_id', pubIds);

    // รวมผล
    const items = pubs.map((p: any) => {
      const latestStaffComment = (reviews || [])
        .filter((r: any) => r.pub_id === p.pub_id && r.reviewer_user_id) // มีผู้รีวิว (staff)
        .map((r: any) => String(r.comment || '').trim())
        .filter(Boolean)
        .pop() || null; // เอา comment ตัวท้ายสุดจากชุดที่ดึงได้

      return {
        pub_id: p.pub_id,
        title: p.pub_name || p.venue_name || `#${p.pub_id}`,
        venue_name: p.venue_name || null,
        year: p.year || null,
        status: p.status,
        updated_at: p.updated_at,
        latest_comment: latestStaffComment,
      };
    });

    return NextResponse.json({ ok: true, count: items.length, items });
  } catch (e: any) {
    console.error('professor notifications error:', e?.message || e);
    return bad(e?.message || 'internal error', 500);
  }
}

export const dynamic = 'force-dynamic';
