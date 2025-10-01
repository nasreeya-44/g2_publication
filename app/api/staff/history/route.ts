// app/api/staff/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let logQuery = supabase
      .from("publication_edit_log")
      .select("edit_id, edited_at, field_name, old_value, new_value, pub_id, user_id")
      .order("edited_at", { ascending: false })
      .limit(200) as any;

    if (from) logQuery = logQuery.gte("edited_at", `${from}T00:00:00.000`);
    if (to)   logQuery = logQuery.lte("edited_at", `${to}T23:59:59.999`);

    const { data: edits, error: e1 } = await logQuery;
    if (e1) throw e1;

    const pubIds = Array.from(new Set((edits ?? []).map((r: any) => r.pub_id))).filter(Boolean);
    const userIds = Array.from(new Set((edits ?? []).map((r: any) => r.user_id))).filter(Boolean);

    const pubMap = new Map<number, string | null>();
    if (pubIds.length) {
      const { data: pubs, error: ePub } = await supabase
        .from("publication")
        .select("pub_id, pub_name")
        .in("pub_id", pubIds);
      if (ePub) throw ePub;
      (pubs || []).forEach((p: any) => pubMap.set(p.pub_id, p.pub_name ?? null));
    }

    const userMap = new Map<number, string>();
    if (userIds.length) {
      const { data: users, error: eUser } = await supabase
        .from("users")
        .select("user_id, first_name, last_name, username")
        .in("user_id", userIds);
      if (eUser) throw eUser;
      (users || []).forEach((u: any) => {
        const name =
          (u.first_name || u.last_name)
            ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()
            : (u.username || `user#${u.user_id}`);
        userMap.set(u.user_id, name);
      });
    }

    const filtered = (edits ?? []).filter((r: any) => {
      if (!q) return true;
      const needle = q.toLowerCase();
      const hay = [
        pubMap.get(r.pub_id) || "",
        r.field_name || "",
        r.old_value || "",
        r.new_value || "",
        userMap.get(r.user_id || 0) || "",
      ].join(" ").toLowerCase();
      return hay.includes(needle);
    });

    const rows = filtered.map((r: any) => ({
      id: r.edit_id,
      when: r.edited_at,
      pub_id: r.pub_id,
      pub_name: pubMap.get(r.pub_id) ?? null,
      user: userMap.get(r.user_id || 0) || "-",
      field: r.field_name,
      old_value: r.old_value ?? null,
      new_value: r.new_value ?? null,
      status_after: null,
    }));

    return NextResponse.json({ ok: true, data: Array.isArray(rows) ? rows : [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "failed" }, { status: 500 });
  }
}