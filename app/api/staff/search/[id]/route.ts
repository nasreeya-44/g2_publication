// app/api/staff/search/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export const dynamic = "force-dynamic";

type RawVenue = { type?: string } | { type?: string }[] | null;
type RawAuthor = {
  author_order: number | null;
  role: string | null;
  person: { full_name?: string | null; affiliation?: string | null } | null;
} | null;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) {
    return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("publication")
    .select(`
      pub_id, pub_name, abstract, year, level, status, created_at, updated_at, venue_name,
      venue:venue(type),
      publication_person(author_order, role, person:person(full_name, affiliation)),
      category_publication(category:category(category_name))
    `)
    .eq("pub_id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, message: "not found" }, { status: 404 });
  }

  // ---- venue.type อาจเป็น array หรือ object ----
  const v: RawVenue = (data as any).venue ?? null;
  const venueType =
    Array.isArray(v) ? v[0]?.type ?? null : (v as { type?: string } | null)?.type ?? null;

  // ---- authors ----
  const rawAuthors = ((data as any).publication_person ?? []) as RawAuthor[];
  const authors = rawAuthors
    .map((p) => ({
      order: p?.author_order ?? 0,
      role: p?.role ?? "",
      name: p?.person?.full_name ?? "-",
      affiliation: p?.person?.affiliation ?? null,
    }))
    .sort((a, b) => a.order - b.order);

  // ---- categories ----
  const categories = (((data as any).category_publication ?? []) as Array<{
    category?: { category_name?: string } | null;
  }>)
    .map((c) => c.category?.category_name)
    .filter(Boolean) as string[];

  const payload = {
    id: (data as any).pub_id as number,
    title: (data as any).pub_name as string,
    abstract: (data as any).abstract as string | null,
    year: (data as any).year as number | null,
    level: (data as any).level as string | null,
    status: (data as any).status as string,
    created_at: (data as any).created_at as string,
    updated_at: (data as any).updated_at as string,
    venue: (data as any).venue_name as string | null,
    type: venueType as string | null,
    authors,
    categories,
  };

  return NextResponse.json({ ok: true, data: payload });
}