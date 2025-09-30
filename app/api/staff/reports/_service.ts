// app/api/staff/reports/_service.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export type ReportParams = {
  year_from: number;
  year_to: number;
  levels: string[];
  statuses: string[];
  has_pdf: "any" | "true" | "false";
  author?: string;
  only_student?: boolean;

  // ตัวกรองใหม่
  type?: "JOURNAL" | "CONFERENCE" | "BOOK";
  cats: string[]; // category_name
};

export function parseQueryForReport(sp: URLSearchParams): ReportParams {
  let yf = Number(sp.get("year_from") || "1900");
  let yt = Number(sp.get("year_to") || "9999");
  if (yf > yt) [yf, yt] = [yt, yf];

  const levels = sp.getAll("level");
  const statuses = sp.getAll("status");
  const hasPdf = (sp.get("has_pdf") as "true" | "false" | null) ?? "any";
  const author = (sp.get("author") || "").trim();
  const only_student = sp.get("only_student") === "1";

  const type = (sp.get("type") as ReportParams["type"]) || undefined;
  const cats = sp.getAll("cat").map((x) => x.trim()).filter(Boolean);

  return { year_from: yf, year_to: yt, levels, statuses, has_pdf: hasPdf as any, author, only_student, type, cats };
}

type Pub = {
  pub_id: number;
  year: number | null;
  status: string;
  has_pdf: boolean | null;
  level: string | null;
  pub_name: string | null;
  venue_id: number | null;
  publication_person?: Array<{
    author_order: number | null;
    role: string | null;
    person: { person_id: number; full_name: string; person_type: string | null } | null;
  }>;
  category_publication?: Array<{ category?: { category_name?: string | null } | null }>;
};

export async function fetchRawPublications(params: ReportParams): Promise<Pub[]> {
  const select =
    "pub_id, year, status, has_pdf, level, pub_name, venue_id," +
    "publication_person ( author_order, role, person:person ( person_id, full_name, person_type ) )," +
    "category_publication ( category:category ( category_name ) )";

  let q: any = supabase
    .from("publication")
    .select(select)
    .gte("year", params.year_from)
    .lte("year", params.year_to);

  if (params.levels.length)   q = q.in("level", params.levels);
  if (params.statuses.length) q = q.in("status", params.statuses);
  if (params.has_pdf === "true")  q = q.eq("has_pdf", true);
  if (params.has_pdf === "false") q = q.eq("has_pdf", false);

  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as Pub[];
}

export async function buildReport(params: ReportParams) {
  // 1) base
  let pubs = await fetchRawPublications(params);

  // 2) author filter
  if (params.author) {
    const a = params.author.toLowerCase();
    pubs = pubs.filter((p) =>
      (p.publication_person ?? []).some((pp) =>
        (pp.person?.full_name ?? "").toLowerCase().includes(a)
      )
    );
  }

  // 3) only student
  if (params.only_student) {
    pubs = pubs.filter((p) =>
      (p.publication_person ?? []).some(
        (pp) => (pp.person?.person_type || "").toUpperCase() === "STUDENT"
      )
    );
  }

  // 4) type filter (venue.type)
  if (params.type) {
    const venueIds = Array.from(new Set(pubs.map((p) => p.venue_id).filter(Boolean))) as number[];
    let vmap = new Map<number, string>();
    if (venueIds.length) {
      const { data: venues, error } = await supabase
        .from("venue")
        .select("venue_id, type")
        .in("venue_id", venueIds);
      if (error) throw error;
      (venues || []).forEach((v: any) => vmap.set(v.venue_id, v.type || null));
    }
    pubs = pubs.filter((p) => (vmap.get(p.venue_id || 0) || "").toUpperCase() === params.type);
  }

  // 5) category filter (อย่างน้อยหนึ่งชื่อที่ระบุต้องตรง)
  if (params.cats.length) {
    const want = params.cats.map((x) => x.toLowerCase());
    pubs = pubs.filter((p) => {
      const names = (p.category_publication ?? [])
        .map((cp) => (cp.category?.category_name || "").toLowerCase())
        .filter(Boolean);
      return names.some((n) => want.includes(n));
    });
  }

  // ---- totals
  const totals = {
    all: pubs.length,
    published:      pubs.filter((p) => p.status === "published").length,
    under_review:   pubs.filter((p) => p.status === "under_review").length,
    needs_revision: pubs.filter((p) => p.status === "needs_revision").length,
    with_students:  pubs.filter((p) =>
      (p.publication_person ?? []).some(
        (pp) => (pp.person?.person_type || "").toUpperCase() === "STUDENT"
      )
    ).length,
  };

  // ---- by year
  const ymap = new Map<number, number>();
  for (const p of pubs) {
    const y = p.year || 0;
    if (!y) continue;
    ymap.set(y, (ymap.get(y) || 0) + 1);
  }
  const byYear = Array.from(ymap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  // ---- top authors (Top 5)
  type Counter = { published: number; under_review: number; total: number };
  const amap = new Map<string, Counter>();
  for (const p of pubs) {
    const names = (p.publication_person ?? [])
      .map((pp) => (pp.person?.full_name ?? "").trim())
      .filter(Boolean) as string[];
    const uniq = Array.from(new Set(names));
    for (const name of uniq) {
      const c = amap.get(name) || { published: 0, under_review: 0, total: 0 };
      c.total += 1;
      if (p.status === "published") c.published += 1;
      if (p.status === "under_review" || p.status === "needs_revision") c.under_review += 1;
      amap.set(name, c);
    }
  }
  const topAuthors = Array.from(amap.entries())
    .map(([name, c]) => ({ name, ...c }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return { totals, byYear, topAuthors };
}