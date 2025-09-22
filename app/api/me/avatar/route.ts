import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSessionUserId } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function POST(req: NextRequest) {
  try {
    const uid = await getSessionUserId(req);
    if (!uid) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ ok: false, message: 'no file' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const objectPath = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(objectPath, bytes, { contentType: file.type, upsert: true });
    if (upErr) throw upErr;

    const publicUrl =
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${objectPath}`;

    const { error: upUserErr } = await supabase
      .from('users')
      .update({ profile_image: publicUrl })
      .eq('user_id', uid);
    if (upUserErr) throw upUserErr;

    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'upload error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
