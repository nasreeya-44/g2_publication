// app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

// PATCH /api/admin/users/:id
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    // Next dynamic route: ต้องอ่าน params จาก ctx.params
    const id = Number(ctx.params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ ok: false, message: 'invalid id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    // รับเฉพาะ field ที่อนุญาต
    const updates: any = {};
    if ('username' in body) updates.username = body.username ?? null;
    if ('first_name' in body) updates.first_name = body.first_name ?? null;
    if ('last_name' in body) updates.last_name = body.last_name ?? null;
    if ('phone' in body) updates.phone = body.phone ?? null;
    if ('position' in body) updates.position = body.position ?? null;
    if ('role' in body) updates.role = body.role; // ADMIN | STAFF | PROFESSOR
    if ('status' in body) updates.status = body.status; // ACTIVE | SUSPENDED
    if ('profile_image' in body) updates.profile_image = body.profile_image ?? null;
    if ('email' in body) updates.email = body.email ?? null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, message: 'no fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('user_id', id)
      .select('user_id, username, first_name, last_name, phone, position, role, status, email, profile_image')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message || 'update user failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';