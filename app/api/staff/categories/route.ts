// app/api/staff/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  let query = supabase
    .from("category")
    .select("category_id, category_name, status, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (q) {
    query = query.ilike("category_name", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name } = body;

  if (!name) {
    return NextResponse.json({ ok: false, message: "name required" }, { status: 400 });
  }

  const { error } = await supabase.from("category").insert({
    category_name: name,
    status: "ACTIVE",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}