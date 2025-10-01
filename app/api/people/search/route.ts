// app/api/people/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function GET(req: NextRequest) {
  try {
    const q = new URL(req.url).searchParams.get('q')?.trim() || '';
    if (!q) return NextResponse.json({ data: [] });

    const { data, error } = await supabase
      .from('person')
      .select('full_name')
      .ilike('full_name', `%${q}%`)
      .order('full_name', { ascending: true })
      .limit(10);
    if (error) throw error;

    return NextResponse.json({ data: (data || []).map((r) => ({ full_name: r.full_name })) });
  } catch (e: any) {
    return NextResponse.json({ data: [], message: e?.message || 'error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
