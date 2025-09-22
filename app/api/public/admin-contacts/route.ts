// app/api/public/admin-contacts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ใช้ Service Role เฉพาะฝั่ง Server เท่านั้น
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

function looksLikeEmail(s?: string | null) {
  if (!s) return false;
  return /\S+@\S+\.\S+/.test(s);
}

export async function GET(req: NextRequest) {
  try {
    // ดึงเฉพาะ Admin ที่ยัง ACTIVE
    const { data, error } = await supabase
      .from('users')
      .select('user_id, first_name, last_name, email, phone, position, username, profile_image')
      .eq('role', 'ADMIN')
      .eq('status', 'ACTIVE')
      .order('first_name', { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    const rows = (data || []).map((u) => {
      const fullName =
        [u.first_name, u.last_name].filter(Boolean).join(' ').trim() ||
        u.username ||
        `#${u.user_id}`;

      // ใช้ email จากคอลัมน์ email ถ้ามี; ถ้าไม่มีและ username เป็นอีเมล ก็ใช้ username
      const email = u.email || (looksLikeEmail(u.username) ? u.username : null);

      // profile_image แนะนำให้เก็บเป็น public URL อยู่แล้ว
      return {
        id: u.user_id,
        name: fullName,
        email,
        phone: u.phone || null,
        position: u.position || null,
        avatar: u.profile_image || null,
      };
    });

    return NextResponse.json({ ok: true, data: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';