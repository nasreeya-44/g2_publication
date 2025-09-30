// app/api/staff/reports/export/xlsx/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchPublications, type Pub } from "../../service";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // 1) ดึงข้อมูลด้วย service (รีไซเคิล query params เดิมทั้งหมด)
    const pubs: Pub[] = await fetchPublications(req);

    // 2) สร้างไฟล์ Excel ด้วย exceljs
    const wb = new ExcelJS.Workbook();
    wb.creator = "Publication System";
    wb.created = new Date();

    const ws = wb.addWorksheet("Publications", {
      properties: { tabColor: { argb: "FF1E293B" } }, // slate-900
      views: [{ state: "frozen", ySplit: 1 }],
    });

    // 3) ตั้งคอลัมน์
    ws.columns = [
      { header: "No.",             key: "no",            width: 6 },
      { header: "Title",           key: "title",         width: 60 },
      { header: "Year",            key: "year",          width: 8 },
      { header: "Status",          key: "status",        width: 16 },
      { header: "Level",           key: "level",         width: 16 },
      { header: "Has PDF",         key: "has_pdf",       width: 10 },
      { header: "Authors",         key: "authors",       width: 40 },
    ];

    // 4) เฮดเดอร์หนา ๆ
    const header = ws.getRow(1);
    header.font = { bold: true };
    header.alignment = { vertical: "middle" };
    header.height = 20;

    // 5) เติมข้อมูล
    pubs.forEach((p: Pub, i: number) => {
      const authors: string = (p.publication_person ?? [])
        .map((pp) => pp.person?.full_name)
        .filter((name: string | undefined | null): name is string => Boolean(name && name.trim()))
        .join(", ");

      ws.addRow({
        no: i + 1,
        title: p.pub_name ?? "(ไม่ระบุ)",
        year: p.year ?? "",
        status: p.status,
        level: p.level ?? "",
        has_pdf: p.has_pdf ? "Yes" : "No",
        authors,
      });
    });

    // จัดให้อ่านง่ายนิดหน่อย
    ws.eachRow((row, rowNumber) => {
      row.alignment = { vertical: "middle" };
      if (rowNumber > 1) {
        row.height = 18;
      }
    });

    // 6) สร้างไฟล์เป็น buffer แล้วส่งกลับ
    const out = (await wb.xlsx.writeBuffer()) as ArrayBuffer | Buffer;

    // ทำให้เป็น Uint8Array เพื่อให้ NextResponse รับได้ชัวร์ ๆ
    const body =
      out instanceof ArrayBuffer ? new Uint8Array(out) : Uint8Array.from(out as Buffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="publication-report.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "failed" },
      { status: 500 }
    );
  }
}