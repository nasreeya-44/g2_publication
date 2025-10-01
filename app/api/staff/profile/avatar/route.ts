import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// --- config ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE!; // ใช้ service role ฝั่ง server เท่านั้น
const bucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET || "avatars";

// client ฝั่ง server
const supabase = createClient(supabaseUrl, supabaseKey);

export const runtime = "nodejs"; // ให้แน่ใจว่าใช้ Node runtime

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, message: "file is required" },
        { status: 400 }
      );
    }

    // แปลงเป็น buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ตั้งชื่อไฟล์ unique
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${ext}`;

    const filePath = `profiles/${fileName}`;

    // อัปโหลดไป supabase storage
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Upload error:", error);
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    // สร้าง public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(filePath);

    return NextResponse.json({ ok: true, publicUrl });
  } catch (e: any) {
    console.error("Unexpected error:", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "upload failed" },
      { status: 500 }
    );
  }
}