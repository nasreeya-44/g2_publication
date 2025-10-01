// app/api/professor/publications/[id]/comments/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ===== types =====
type StatusRow = {
  pub_id: number
  changed_at: string
  changed_by: number | null
  note: string | null
  status: string
}

type ReviewRow = {
  review_id: number
  pub_id: number
  user_id: number | null
  reviewer_user_id: number | null
  action: string
  comment: string | null
}

type UserRow = {
  user_id: number
  first_name: string | null
  last_name: string | null
  role: string | null
  email: string | null
}

type ReviewComment = {
  id: string | number
  created_at: string
  author_name: string | null
  author_role: string | null
  text: string
  status_tag?: string | null
}

// ===== supabase client =====
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
)

export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const pubId = Number(ctx.params.id)
    if (!Number.isFinite(pubId)) {
      return NextResponse.json({ ok: false, message: 'invalid pub_id' }, { status: 400 })
    }

    // 1) ดึง status history ทั้งหมดของผลงานนี้ (เป็นแหล่งเวลา/เหตุการณ์)
    const { data: statusRows, error: stErr } = await supabase
      .from('publication_status_history')
      .select('pub_id, changed_at, changed_by, note, status')
      .eq('pub_id', pubId)
      .order('changed_at', { ascending: false }) as unknown as { data: StatusRow[] | null, error: any }
    if (stErr) throw stErr

    const statusList = statusRows ?? []

    // 2) ดึง "คอมเมนต์ล่าสุด" ของผลงานนั้นจาก review_action (ไม่ใช้ note)
    const { data: reviewRows, error: rvErr } = await supabase
      .from('review_action')
      .select('review_id, pub_id, user_id, reviewer_user_id, action, comment')
      .eq('pub_id', pubId)
      .order('review_id', { ascending: false })
      .limit(1) as unknown as { data: ReviewRow[] | null, error: any }
    if (rvErr) throw rvErr

    const latestReviewComment = (reviewRows ?? [])
      .map(r => (r.comment ?? '').trim())
      .find(c => c.length > 0) || '' // ถ้าไม่มีคอมเมนต์ ให้เว้นว่าง

    // 3) รวบรวม user_id ที่ต้อง lookup ชื่อ (เฉพาะคนที่เปลี่ยนสถานะ)
    const userIds = new Set<number>()
    statusList.forEach(r => { if (r.changed_by != null) userIds.add(r.changed_by) })

    let userMap = new Map<number, UserRow>()
    if (userIds.size > 0) {
      const { data: users, error: uErr } = await supabase
        .from('users')
        .select('user_id, first_name, last_name, role, email')
        .in('user_id', Array.from(userIds)) as unknown as { data: UserRow[] | null, error: any }
      if (uErr) throw uErr
      for (const u of users ?? []) userMap.set(u.user_id, u)
    }

    // 4) map status history → comments
    //    - ยังคงแสดงเหตุการณ์ทั้งหมดตาม publication_status_history
    //    - แต่ "text" ให้มาจาก review_action.comment ล่าสุดเท่านั้น
    //    - ถ้าไม่มีคอมเมนต์ ให้เป็น '' (หน้าเว็บจะแสดงว่าง)
    const fromStatus: ReviewComment[] = statusList.map((s, idx) => {
      const u = s.changed_by != null ? userMap.get(s.changed_by) : undefined
      const author_name =
        u ? [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || null : null
      return {
        id: `status-${idx}-${s.changed_at}`,
        created_at: s.changed_at,
        author_name,
        author_role: u?.role ?? null,
        text: latestReviewComment,     // ★ ใช้คอมเมนต์จาก review_action เท่านั้น
        status_tag: s.status || null,  // แสดงสถานะตามเดิม
      }
    })

    // 5) ส่งเฉพาะไทม์ไลน์จากสถานะ (ไม่มีบล็อกของ review แยกอีกต่อไป)
    const combined = fromStatus.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return NextResponse.json({ ok: true, data: combined })
  } catch (e: any) {
    console.error('comments error:', e?.message || e)
    return NextResponse.json({ ok: false, message: e?.message || 'internal error' }, { status: 500 })
  }
}
