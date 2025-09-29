import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

type Row = {
  pub_id: number;
  pub_name: string | null;
  year: number | null;
  level: string | null;
  updated_at: string | null;
  has_pdf: boolean | null;
  // join ผู้แต่ง
  publication_person?: Array<{
    person: { full_name: string | null } | null;
  }>;
  // join หมวดหมู่ผ่านตารางกลาง category_publication → category(category_name)
  category_publication?: Array<{
    category: { category_name: string | null } | null;
  }>;
  // เอาประเภทวารสาร/งานประชุมจากตาราง venue (ตาม schema)
  venue?: { type: string | null } | null;
};

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;

    const page = Math.max(1, Number(sp.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, Number(sp.get("page_size") || "10")));

    const q = (sp.get("q") || "").trim();
    const scope = (sp.get("scope") || "all") as "all" | "title" | "author";

    let yearFrom = sp.get("year_from") ? Number(sp.get("year_from")) : null;
    let yearTo = sp.get("year_to") ? Number(sp.get("year_to")) : null;
    if (yearFrom && yearTo && yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];

    // ประเภทงานใน schema นี้อยู่ที่ตาราง venue.type
    const ptype = sp.get("type") || ""; // JOURNAL / CONFERENCE / BOOK
    const levels = sp.getAll("level");  // NATIONAL / INTERNATIONAL
    const hasPdf = sp.get("has_pdf");   // "true" | "false" | null
    const onlyStudent = sp.get("only_student") === "1";
    const cats = sp.getAll("cat");      // category_name ที่เลือกมา

    // ---------- SELECT + JOIN ให้ตรง schema ----------
    const select =
      "pub_id, pub_name, year, level, updated_at, has_pdf," +
      "venue:venue(type)," +
      "publication_person(person:person(full_name))," +
      "category_publication(category:category(category_name))";

    let qBase = supabase.from("publication").select(select) as any;

    if (yearFrom) qBase = qBase.gte("year", yearFrom);
    if (yearTo) qBase = qBase.lte("year", yearTo);
    if (levels.length) qBase = qBase.in("level", levels);
    if (hasPdf === "true") qBase = qBase.eq("has_pdf", true);
    if (hasPdf === "false") qBase = qBase.eq("has_pdf", false);
    // filter ประเภทผ่าน venue.type
    if (ptype) qBase = qBase.eq("venue.type", ptype);

    const { data, error } = await qBase;
    if (error) throw error;

    let rows = (data || []) as Row[];

    // ---- filter รายชื่อหมวดหมู่ (cats) ด้วย category_name ----
    if (cats.length) {
      const set = new Set(cats.map((c) => c.toLowerCase()));
      rows = rows.filter((r) =>
        (r.category_publication ?? []).some((cp) =>
          (cp?.category?.category_name || "").toLowerCase() &&
          set.has((cp!.category!.category_name as string).toLowerCase())
        )
      );
    }

    // ---- คีย์เวิร์ด ----
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter((r) => {
        const title = (r.pub_name || "").toLowerCase();
        const authors = (r.publication_person ?? [])
          .map((pp) => pp.person?.full_name || "")
          .join(" ")
          .toLowerCase();

        if (scope === "title") return title.includes(needle);
        if (scope === "author") return authors.includes(needle);
        return `${title} ${authors}`.includes(needle);
      });
    }

    // ---- only student involved (หากมี person_type ให้ join person.person_type แล้วกรอง) ----
    if (onlyStudent) {
      // ใน schema นี้ table person มี person_type แต่เราไม่ได้ select มา
      // ถ้าต้องใช้จริง ให้แก้ select publication_person(person:person(full_name,person_type))
      // แล้วเปิดคอมเมนต์ด้านล่าง:
      // rows = rows.filter(r =>
      //   (r.publication_person ?? []).some(pp => (pp.person as any)?.person_type?.toUpperCase() === "STUDENT")
      // );
    }

    // ---- รูปแบบ items สำหรับ UI ----
    const itemsAll = rows.map((r) => ({
      pub_id: r.pub_id,
      pub_name: r.pub_name,
      year: r.year,
      type: r.venue?.type ?? null, // ใช้จาก venue.type
      level: r.level,
      updated_at: r.updated_at,
      has_pdf: r.has_pdf,
      authors: (r.publication_person ?? [])
        .map((pp) => pp.person?.full_name)
        .filter(Boolean) as string[],
      categories: (r.category_publication ?? [])
        .map((cp) => cp.category?.category_name)
        .filter(Boolean) as string[],
    }));

    // ---- Facets: นับหมวดหมู่เฉพาะที่ “มีงานในผลลัพธ์หลังกรองแล้ว” ----
    const facMap = new Map<string, number>();
    for (const r of itemsAll) {
      for (const c of r.categories) {
        facMap.set(c, (facMap.get(c) || 0) + 1);
      }
    }
    const facets = {
      categories: Array.from(facMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    };

    // ---- Paging ----
    const total = itemsAll.length;
    const start = (page - 1) * pageSize;
    const items = itemsAll.slice(start, start + pageSize);

    return NextResponse.json({
      ok: true,
      data: { items, total, page, page_size: pageSize, facets },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "failed" }, { status: 500 });
  }
}