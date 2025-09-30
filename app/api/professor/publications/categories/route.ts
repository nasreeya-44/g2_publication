// app/api/professor/publications/categories/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get('status') || 'ACTIVE').toUpperCase();

    const { data, error } = await supabase
      .from('category')
      .select('category_id, category_name, status')
      .eq('status', status)
      .order('category_name', { ascending: true });

    if (error) throw error;

    const out = (data || []).map((c) => ({
      category_id: c.category_id,
      category_name: c.category_name,
    }));

    return NextResponse.json({ ok: true, data: out });
  } catch (e: any) {
    console.error('categories list error:', e?.message || e);
    return NextResponse.json({ ok: false, message: e?.message || 'internal error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
