import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

type Pub = {
  pub_id: number;
  year: number | null;
  status: string;
  has_pdf: boolean | null;
  level: string | null;
  pub_name: string | null;
  publication_person?: Array<{
    author_order: number | null;
    role: string | null;
    person: { person_id: number; full_name: string; person_type: string | null } | null;
  }>;
};

export type ReportData = {
  totals: {
    all: number;
    published: number;
    under_review: number;
    needs_revision: number;
    with_students: number;
  };
  byYear: Array<{ year: number; count: number }>;
  topAuthors: Array<{ name: string; total: number; published: number; under_review: number }>;
};

export type ReportParams = {
  yearFrom: number;
  yearTo: number;
  author: string;
  levels: string[];
  statuses: string[];
  hasPdf?: "true" | "false" | null;
  onlyStudent: boolean;
};

export async function buildReport(params: ReportParams): Promise<ReportData> {
  let { yearFrom, yearTo, author, levels, statuses, hasPdf, onlyStudent } = params;
  if (yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];

  const select =
    "pub_id, year, status, has_pdf, level, pub_name," +
    "publication_person ( author_order, role, person:person ( person_id, full_name, person_type ) )";

  let q = supabase
    .from("publication")
    .select(select)
    .gte("year", yearFrom)
    .lte("year", yearTo) as any;

  if (levels.length)   q = q.in("level", levels);
  if (statuses.length) q = q.in("status", statuses);
  if (hasPdf === "true")  q = q.eq("has_pdf", true);
  if (hasPdf === "false") q = q.eq("has_pdf", false);

  const { data, error } = await q;
  if (error) throw error;
  const pubs = (data || []) as Pub[];

  // filter by author (JS)
  let filtered = pubs;
  if (author?.trim()) {
    const a = author.trim().toLowerCase();
    filtered = filtered.filter((p) =>
      (p.publication_person ?? []).some(
        (pp) => (pp.person?.full_name ?? "").toLowerCase().includes(a)
      )
    );
  }

  // only student
  if (onlyStudent) {
    filtered = filtered.filter((p) =>
      (p.publication_person ?? []).some(
        (pp) => (pp.person?.person_type || "").toUpperCase() === "STUDENT"
      )
    );
  }

  // totals
  const totals = {
    all: filtered.length,
    published:      filtered.filter((p) => p.status === "published").length,
    under_review:   filtered.filter((p) => p.status === "under_review").length,
    needs_revision: filtered.filter((p) => p.status === "needs_revision").length,
    with_students:  filtered.filter((p) =>
      (p.publication_person ?? []).some(
        (pp) => (pp.person?.person_type || "").toUpperCase() === "STUDENT"
      )
    ).length,
  };

  // by year
  const ymap = new Map<number, number>();
  for (const p of filtered) {
    const y = p.year || 0;
    if (!y) continue;
    ymap.set(y, (ymap.get(y) || 0) + 1);
  }
  const byYear = Array.from(ymap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  // top authors
  type Counter = { published: number; under_review: number; total: number };
  const amap = new Map<string, Counter>();
  for (const p of filtered) {
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

export function parseQueryForReport(sp: URLSearchParams): ReportParams {
  return {
    yearFrom: Number(sp.get("year_from") || "1900"),
    yearTo:   Number(sp.get("year_to")   || "9999"),
    author:   (sp.get("author") || "").trim(),
    levels:   sp.getAll("level"),
    statuses: sp.getAll("status"),
    hasPdf:   sp.get("has_pdf") as any,
    onlyStudent: sp.get("only_student") === "1",
  };
}