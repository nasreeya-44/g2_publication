// app/api/staff/reports/export/pdf/route.ts
import type { NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs";
import PDFDocument from "pdfkit";
import { getReportData } from "../../service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 1) ปิดการโหลด Helvetica ตอนสร้างเอกสาร (แก้ root cause)
const PDFDocAny = PDFDocument as any;
const originalInitFonts = PDFDocAny.prototype.initFonts;
PDFDocAny.prototype.initFonts = function initFontsPatched() {
  // ไม่เรียก Helvetica ที่เป็นค่า default
  // จะตั้งฟอนต์เองหลัง new PDFDocument() แล้ว
};

// 2) helper หาไฟล์ฟอนต์ .ttf (ต้องมีจริง)
function mustFontPath(rel: string) {
  const full = path.join(process.cwd(), rel);
  if (!fs.existsSync(full)) {
    throw new Error(
      `Missing font file: ${rel}\n` +
        `Put your TTF here: ${path.join(process.cwd(), "fonts")}\n` +
        `Example: fonts/NotoSansThai-Regular.ttf, fonts/NotoSansThai-Bold.ttf`
    );
  }
  return full;
}

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const { pubs } = await getReportData(sp);

    // 3) สร้าง PDF (ตอนนี้ไม่โหลด Helvetica แล้ว เพราะเรา patched)
    const doc = new PDFDocument({ margin: 32, size: "A4" });

    // เก็บบัฟเฟอร์
    const chunks: Buffer[] = [];
    let finished = false;
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c as any)));
    doc.on("end", () => (finished = true));

    // 4) โหลดฟอนต์เราเอง แล้วตั้งเป็นค่าเริ่มต้น
    const REGULAR = mustFontPath("fonts/NotoSansThai-Regular.ttf");
    const BOLD = mustFontPath("fonts/NotoSansThai-Bold.ttf");
    doc.registerFont("th-regular", REGULAR);
    doc.registerFont("th-bold", BOLD);

    const useRegular = () => doc.font("th-regular");
    const useBold = () => doc.font("th-bold");

    // ตั้ง default ฟอนต์หน้าแรก
    useRegular();

    // ถ้ามีการเพิ่มหน้าใหม่ ให้ตั้งฟอนต์ซ้ำ (กัน fallback)
    doc.on("pageAdded", () => {
      useRegular();
    });

    // 5) เนื้อหา
    useBold().fontSize(16).fillColor("black").text("รายงานผลงานตีพิมพ์", { align: "center" });
    doc.moveDown(0.5);

    const paramsLine = Array.from(sp.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("  ");
    if (paramsLine) {
      useRegular().fontSize(9).fillColor("gray").text(paramsLine, { align: "center" });
      doc.moveDown(0.5);
    }

    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor("#e5e7eb")
      .stroke();
    doc.moveDown();

    if (!pubs || pubs.length === 0) {
      useRegular().fontSize(12).fillColor("gray").text("ไม่พบข้อมูล", { align: "center" });
    } else {
      pubs.forEach((p, idx) => {
        const title = p.pub_name ?? "(ไม่ระบุชื่อเรื่อง)";
        const meta =
          `ปี: ${p.year ?? "-"} | สถานะ: ${p.status ?? "-"} | ` +
          `ระดับ: ${p.level ?? "-"} | PDF: ${p.has_pdf ? "มี" : "ไม่มี"}`;

        const authors =
          (p.publication_person ?? [])
            .map((pp: any) => pp?.person?.full_name)
            .filter(Boolean)
            .join(", ") || "-";

        useBold().fontSize(12).fillColor("black").text(`${idx + 1}. ${title}`);
        useRegular().fontSize(10).fillColor("#374151").text(meta);
        useRegular().fontSize(10).fillColor("#111827").text(`ผู้แต่ง: ${authors}`);
        doc.moveDown(0.5);

        doc
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .strokeColor("#f3f4f6")
          .stroke();
        doc.moveDown(0.5);
      });
    }

    doc.end();
    await new Promise<void>((r) => (finished ? r() : doc.on("end", () => r())));
    const buf = Buffer.concat(chunks);

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buf.length),
        "Content-Disposition": `attachment; filename="publication-report.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, message: e?.message || "failed", stack: e?.stack }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    // คืนค่า initFonts เผื่อมีไฟล์อื่นๆ ใช้ pdfkit ต่อ (ไม่จำเป็นก็ได้)
    PDFDocAny.prototype.initFonts = originalInitFonts;
  }
}