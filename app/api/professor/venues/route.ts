// app/api/professor/venues/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ใช้รูปแบบเดียวกับ categories route ของคุณ
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : undefined;

    // สร้าง query พื้นฐาน
    let query = supabase
      .from('venue')
      .select('venue_id, type')
      .order('type', { ascending: true });

    // ค้นหาตามชื่อประเภท (type) ถ้ามี q
    if (q) {
      query = query.ilike('type', `%${q}%`);
    }

    // จำกัดจำนวนผลลัพธ์ ถ้ามี limit
    if (limit && Number.isFinite(limit) && limit > 0) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    const out = (data || [])
      .filter((v) => v.venue_id != null && typeof v.type === 'string')
      .map((v) => ({
        venue_id: v.venue_id as number,
        type: (v.type || '').trim(),
      }));

    return NextResponse.json({ ok: true, data: out });
  } catch (e: any) {
    console.error('venues list error:', e?.message || e);
    return NextResponse.json(
      { ok: false, message: e?.message || 'internal error' },
      { status: 500 }
    );
  }
}

// ให้เป็น dynamic route (ไม่ cache)
export const dynamic = 'force-dynamic';
