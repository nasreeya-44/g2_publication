// app/api/staff/reviews/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ----- Types เพื่อกัน implicit any -----
type PersonRow = { full_name: string | null; email: string | null };
type PubPersonRow = {
  author_order: number | null;
  role: string | null;
  person: PersonRow | null;
};
type PubRow = {
  pub_id: number;
  pub_name: string | null;
  level: string | null;
  year: number | null;
  status: string | null;
  updated_at: string | null;
  venue_name: string | null;
  link_url: string | null;
  file_path: string | null;
  has_pdf: boolean | null;
  abstract: string | null;
  people: PubPersonRow[] | null;
};

type HistoryRow = {
  changed_at: string;
  status: string;
  note: string | null;
  by: { first_name: string | null; last_name: string | null }[] | { first_name: string | null; last_name: string | null } | null;
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!id) {
    return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  // อย่าใส่คอมเมนต์ภายในสตริง select
  const { data: pub, error: ePub } = await supabase
    .from("publication")
    .select(`
      pub_id, pub_name, level, year, status, updated_at, venue_name, link_url, file_path, has_pdf, abstract,
      people:publication_person(
        author_order, role,
        person:person_id(full_name, email)
      )
    `)
    .eq("pub_id", id)
    .maybeSingle<PubRow>();

  if (ePub) {
    return NextResponse.json({ ok: false, message: ePub.message }, { status: 500 });
  }
  if (!pub) {
    return NextResponse.json({ ok: false, message: "not found" }, { status: 404 });
  }

  // map authors
  const people = (pub.people ?? []) as PubPersonRow[];
  type Author = { order: number; role: string; name: string; email: string | null };

  const authors: Author[] = people
    .map((p) => ({
      order: p.author_order ?? 0,
      role: (p.role ?? "").toUpperCase(),
      name: p.person?.full_name ?? "-",
      email: p.person?.email ?? null,
    }))
    .sort((a, b) => a.order - b.order);

  const owner: Author | null =
    authors.find((a) => ["LEAD", "OWNER"].includes(a.role)) ?? authors[0] ?? null;

  const corresponding: Author | null =
    authors.find((a) => a.role === "CORRESPONDING") ?? null;

  // ประวัติสถานะ
  const { data: hist, error: eHist } = await supabase
    .from("publication_status_history")
    .select(`
      changed_at, status, note,
      by:users!publication_status_history_changed_by_fkey(first_name,last_name)
    `)
    .eq("pub_id", id)
    .order("changed_at", { ascending: false })
    .limit(20)
    .returns<HistoryRow[]>();

  if (eHist) {
    return NextResponse.json({ ok: false, message: eHist.message }, { status: 500 });
  }

  const history = (hist || []).map((h) => {
    const byRow = Array.isArray(h.by) ? h.by[0] : h.by;
    const byName = byRow ? `${byRow.first_name ?? ""} ${byRow.last_name ?? ""}`.trim() : "-";
    return {
      when: h.changed_at,
      action: h.status,
      by: byName,
      note: h.note ?? null,
    };
  });

  const payload = {
    id: pub.pub_id,
    title: pub.pub_name,
    type: "PUBLICATION",
    level: pub.level,
    year: pub.year,
    venue: pub.venue_name ?? null,
    owner_name: owner?.name ?? null,
    corresponding_email: corresponding?.email ?? null,
    doi_url: pub.link_url ?? null,
    status: String(pub.status ?? "").toUpperCase(),
    updated_at: pub.updated_at,
    authors: authors.map((a) => ({ order: a.order, name: a.name, role: a.role })),
    history,
    review_files_count: pub.file_path ? 1 : 0,
    abstract: pub.abstract ?? null, // ส่งออก abstract
  };

  return NextResponse.json({ ok: true, data: payload });
}