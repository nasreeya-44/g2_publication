// app/api/staff/reports/export/csv/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stringify } from "csv-stringify/sync";
import { fetchPublications, Pub } from "../../service"; // ดึง type Pub มาด้วย

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // ใช้ service ที่เราเขียนไว้
    const pubs: Pub[] = await fetchPublications(req);

    // map เป็น rows สำหรับ CSV
    const rows = pubs.map((p: Pub) => ({
      pub_id: p.pub_id,
      year: p.year ?? "",
      status: p.status,
      level: p.level ?? "",
      pub_name: p.pub_name ?? "",
      authors: (p.publication_person ?? [])
        .map(
          (pp) =>
            `${pp.person?.full_name || ""} (${pp.person?.person_type || "-"})`
        )
        .join("; "),
    }));

    // แปลงเป็น CSV string
    const csv = stringify(rows, {
      header: true,
      columns: [
        { key: "pub_id", header: "Publication ID" },
        { key: "year", header: "Year" },
        { key: "status", header: "Status" },
        { key: "level", header: "Level" },
        { key: "pub_name", header: "Title" },
        { key: "authors", header: "Authors" },
      ],
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="publications.csv"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "failed to export CSV" },
      { status: 500 }
    );
  }
}