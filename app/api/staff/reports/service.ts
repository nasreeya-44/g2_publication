// app/api/staff/reports/service.ts
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export type Pub = {
  pub_id: number;
  year: number | null;
  status: string;
  has_pdf: boolean | null;
  level: string | null;
  pub_name: string | null;
  publication_person?: Array<{
    author_order: number | null;
    role: string | null;
    person: {
      person_id: number;
      full_name: string;
      person_type: string | null;
    } | null;
  }>;
};

/* -------------------------- internal helpers -------------------------- */
type ParsedFilters = {
  yearFrom: number;
  yearTo: number;
  author: string;
  levels: string[];
  statuses: string[];
  hasPdf: "true" | "false" | null;
  onlyStudent: boolean;
};

function parseSearchParams(sp: URLSearchParams): ParsedFilters {
  let yearFrom = Number(sp.get("year_from") || "1900");
  let yearTo = Number(sp.get("year_to") || "9999");
  if (yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];

  return {
    yearFrom,
    yearTo,
    author: (sp.get("author") || "").trim(),
    levels: sp.getAll("level"),
    statuses: sp.getAll("status"),
    hasPdf: ((): "true" | "false" | null => {
      const v = sp.get("has_pdf");
      return v === "true" || v === "false" ? v : null;
    })(),
    onlyStudent: sp.get("only_student") === "1",
  };
}

async function querySupabase(filters: ParsedFilters): Promise<Pub[]> {
  const { yearFrom, yearTo, levels, statuses, hasPdf } = filters;

  const select =
    "pub_id, year, status, has_pdf, level, pub_name," +
    "publication_person ( author_order, role, person:person ( person_id, full_name, person_type ) )";

  let q = supabase
    .from("publication")
    .select(select)
    .gte("year", yearFrom)
    .lte("year", yearTo) as any;

  if (levels.length) q = q.in("level", levels);
  if (statuses.length) q = q.in("status", statuses);
  if (hasPdf === "true") q = q.eq("has_pdf", true);
  if (hasPdf === "false") q = q.eq("has_pdf", false);

  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as Pub[];
}

function applyJsFilters(pubs: Pub[], filters: ParsedFilters): Pub[] {
  let out = pubs;

  // filter by author (case-insensitive)
  if (filters.author) {
    const a = filters.author.toLowerCase();
    out = out.filter((p) =>
      (p.publication_person ?? []).some((pp) =>
        (pp.person?.full_name ?? "").toLowerCase().includes(a)
      )
    );
  }

  // onlyStudent
  if (filters.onlyStudent) {
    out = out.filter((p) =>
      (p.publication_person ?? []).some(
        (pp) => (pp.person?.person_type || "").toUpperCase() === "STUDENT"
      )
    );
  }

  return out;
}

/* ------------------------------ exports ------------------------------ */

/** ใช้ใน API ที่มี `req: NextRequest` โดยตรง */
export async function fetchPublications(req: NextRequest): Promise<Pub[]> {
  const sp = new URL(req.url).searchParams;
  const filters = parseSearchParams(sp);
  const pubs = await querySupabase(filters);
  return applyJsFilters(pubs, filters);
}

/** ใช้ใน export routes (CSV/XLSX/PDF) ที่ส่ง `URLSearchParams` เข้ามา */
export async function fetchPublicationsFromSearchParams(sp: URLSearchParams): Promise<Pub[]> {
  const filters = parseSearchParams(sp);
  const pubs = await querySupabase(filters);
  return applyJsFilters(pubs, filters);
}

/** Facade ตัวเดียวสำหรับทุกที่ (ไฟล์ export เรียกตัวนี้ได้เลย) */
export async function getReportData(sp: URLSearchParams): Promise<{ pubs: Pub[] }> {
  const pubs = await fetchPublicationsFromSearchParams(sp);
  return { pubs };
}