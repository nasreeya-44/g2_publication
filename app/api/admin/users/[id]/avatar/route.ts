import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // ใช้ service role เพื่ออัปโหลดได้แน่นอน
);

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const userId = Number(ctx.params.id);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ ok: false, message: 'invalid user id' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, message: 'file is required' }, { status: 400 });
    }

    const bucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'avatars';

    // ตรวจว่ามี bucket จริงไหม (ถ้า error = ไม่มี bucket/สิทธิ์ไม่พอ)
    const testList = await supabase.storage.from(bucket).list('');
    if ((testList as any)?.error) {
      return NextResponse.json(
        { ok: false, message: `Bucket "${bucket}" not found or inaccessible` },
        { status: 400 }
      );
    }

    // ตั้ง path: users/{id}/{timestamp}_{originalName}
    const ts = Date.now();
    const safeName = file.name.replace(/[^\w.\-]/g, '_');
    const ext = safeName.split('.').pop();
    const path = `users/${userId}/${ts}.${ext || 'jpg'}`;

    // อัปโหลด
    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });

    if (uploadErr) {
      return NextResponse.json({ ok: false, message: uploadErr.message }, { status: 500 });
    }

    // ถ้าบัคเก็ตเป็น Public: ใช้ getPublicUrl ได้
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = pub?.publicUrl || null;

    // อัปเดต users.profile_image
    const { data, error } = await supabase
      .from('users')
      .update({ profile_image: publicUrl })
      .eq('user_id', userId)
      .select('user_id, profile_image')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, publicUrl: publicUrl, data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message || 'upload failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';