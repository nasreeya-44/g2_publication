// app/api/staff/reports/export/pdf/route.ts
import { NextRequest } from "next/server";
import PDFDocument from "pdfkit";
import { getReportData, Pub } from "../../service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // ต้องเป็น Node เพื่อใช้ pdfkit

async function buildPdfBuffer(pubs: Pub[]): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // --------- เนื้อหา PDF ----------
    doc.fontSize(16).fillColor("black").text("รายงานผลงานตีพิมพ์", { align: "center" });
    doc.moveDown();

    pubs.forEach((p, i) => {
      doc.fontSize(12).fillColor("black").text(`${i + 1}. ${p.pub_name ?? "(ไม่ระบุ)"}`);
      doc
        .fontSize(10)
        .fillColor("gray")
        .text(
          `ปี: ${p.year ?? "-"} | สถานะ: ${p.status} | ระดับ: ${p.level ?? "-"} | PDF: ${
            p.has_pdf ? "มี" : "ไม่มี"
          }`
        );

      const authors = (p.publication_person ?? [])
        .map((pp) => pp.person?.full_name)
        .filter(Boolean)
        .join(", ");

      doc.fontSize(10).fillColor("black").text(`ผู้แต่ง: ${authors || "-"}`);
      doc.moveDown();
    });

    doc.end();
  });
}

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const { pubs } = await getReportData(sp);

    const buf = await buildPdfBuffer(pubs);

    // ✅ แปลง Buffer -> ArrayBuffer (ระวัง byteOffset/byteLength)
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;

    return new Response(ab, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buf.length),
        "Content-Disposition": 'attachment; filename="publication-report.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, message: e?.message || "failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}