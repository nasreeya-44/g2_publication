// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

// GET /api/admin/users?q=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();

    let query = supabase
      .from('users')
      .select('user_id, username, first_name, last_name, phone, position, role, status, profile_image, email')
      .order('user_id', { ascending: true })
      .limit(500);

    if (q) {
      // ค้นหาจาก username, first_name, last_name, email
      query = query.or(
        `username.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message || 'list users failed' }, { status: 500 });
  }
}

// POST /api/admin/users  (create user)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const username: string | null = body?.username ?? null;
    const password: string | undefined = body?.password;
    const first_name: string | null = body?.first_name ?? null;
    const last_name: string | null = body?.last_name ?? null;
    const phone: string | null = body?.phone ?? null;
    const position: string | null = body?.position ?? null;
    const role: 'ADMIN' | 'STAFF' | 'PROFESSOR' = body?.role || 'PROFESSOR';
    const status: 'ACTIVE' | 'SUSPENDED' = body?.status || 'ACTIVE';
    const email: string | null = body?.email ?? null;

    if (!password) {
      return NextResponse.json({ ok: false, message: 'password is required' }, { status: 400 });
    }
    if (!role) {
      return NextResponse.json({ ok: false, message: 'role is required' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          username,
          password_hash,
          first_name,
          last_name,
          phone,
          position,
          role,    // enum: ADMIN | STAFF | PROFESSOR
          status,  // enum: ACTIVE | SUSPENDED
          email,
          profile_image: null,
        },
      ])
      .select('user_id, username, first_name, last_name, phone, position, role, status, email, profile_image')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message || 'create user failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';