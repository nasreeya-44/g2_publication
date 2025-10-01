import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server only
);

async function getUser(req: NextRequest) {
  const token = req.cookies.get('app_session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET!));
    return payload as { user_id: number; username: string; role: 'ADMIN'|'STAFF'|'PROFESSOR' };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getUser(req);
  if (!me) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (!(me.role === 'STAFF' || me.role === 'ADMIN')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const pubId = Number(params.id);
  if (!Number.isFinite(pubId)) return NextResponse.json({ message: 'Invalid id' }, { status: 400 });

  try {
    const { data: pub, error } = await supabase
      .from('publication')
      .select(`
        pub_id, link_url, level, year, has_pdf, file_path,
        venue_id, venue_name, status, created_at, updated_at
      `)
      .eq('pub_id', pubId)
      .maybeSingle();
    if (error) throw error;
    if (!pub) return NextResponse.json({ message: 'Not found' }, { status: 404 });

    // authors
    const { data: ppl } = await supabase
      .from('publication_person')
      .select('author_order, role, person:person_id(full_name, email, affiliation)')
      .eq('pub_id', pubId)
      .order('author_order', { ascending: true });

    const authors = (ppl || []).map((r: any) => ({
      name: r.person?.full_name ?? '',
      email: r.person?.email ?? null,
      affiliation: r.person?.affiliation ?? null,
      order: r.author_order ?? null,
      role: r.role ?? null,
    }));

    // categories
    const { data: cps } = await supabase
      .from('category_publication')
      .select('category:category_id(category_name)')
      .eq('pub_id', pubId);

    const categories = (cps || [])
      .map((x: any) => x.category?.category_name as string | undefined)
      .filter(Boolean) as string[];

    // venue type (optional)
    let venue_type: string | null = null;
    if (pub.venue_id) {
      const { data: v } = await supabase.from('venue').select('type').eq('venue_id', pub.venue_id).maybeSingle();
      venue_type = v?.type ?? null;
    }

    return NextResponse.json({
      ok: true,
      ...pub,
      venue_type,
      authors,
      categories,
    });
  } catch (e: any) {
    console.error('staff detail error:', e?.message || e);
    return NextResponse.json({ message: e?.message || 'internal error' }, { status: 500 });
  }
}
