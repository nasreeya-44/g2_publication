// app/api/me/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE!;

// หมายเหตุ: ตัวอย่างนี้ยังไม่ได้ตรวจ session จริง ๆ
// คุณควรเปลี่ยนไปอ่าน user_id จาก session/cookie ของโปรเจกต์คุณเอง
export async function GET() {
  try {
    const supabase = createClient(url, service);

    // เดโม่: ดึง user คนแรกเป็น me
    const { data, error } = await supabase
      .from('users')
      .select('user_id, username, first_name, last_name, role, status, profile_image')
      .order('user_id', { ascending: true })
      .limit(1)
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message || 'internal error' }, { status: 500 });
  }
}