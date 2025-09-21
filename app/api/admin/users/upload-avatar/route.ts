// app/api/admin/users/upload-avatar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // Service Role
);

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, message: 'file is required' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // upload to Supabase
    const { error } = await supabase.storage.from('public').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;

    const { data: pub } = supabase.storage.from('public').getPublicUrl(path);
    const url = pub?.publicUrl;

    return NextResponse.json({ ok: true, url });
  } catch (err: any) {
    console.error('upload-avatar error:', err?.message || err);
    return NextResponse.json({ ok: false, message: err?.message || 'upload failed' }, { status: 500 });
  }
}