// app/staff/layout.tsx
import type { ReactNode } from "react";
import StaffSideRail from "@/components/StaffSideRail";
import UserDropdown from "@/components/UserDropdown";
import Link from "next/link";
import { headers, cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  noStore(); // กัน cache เวลาเรียก /api/staff/me

  // ----- เตรียม URL /api/staff/me -----
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const meUrl = `${proto}://${host}/api/staff/me`;

  // ----- แนบคุกกี้ไปกับ fetch (เพื่อส่ง session ไป API) -----
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
    .join("; ");

  // ----- ดึงข้อมูลผู้ใช้จาก /api/staff/me -----
  let me:
    | {
        name?: string;
        username?: string;
        role?: string;
        avatarUrl?: string | null;
      }
    | null = null;

  try {
    const res = await fetch(meUrl, {
      cache: "no-store",
      headers: { cookie: cookieHeader },
    });
    if (res.ok) {
      const j = await res.json();
      me = j?.user ?? null;
    }
  } catch {
    me = null;
  }

  return (
    <div className="min-h-screen bg-[#F6F9FC]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700">STAFF</div>

          {me ? (
            <UserDropdown
              user={{
                name: me.name || me.username || "ผู้ใช้",
                role: (me.role || "STAFF").toUpperCase(),
                image: me.avatarUrl || "/avatar.png",
              }}
              profileHref="/staff/profile"
              logoutHref="/api/logout"
            />
          ) : (
            <Link
              href="/login"
              className="text-sm px-3 py-2 rounded-xl border bg-white hover:bg-gray-50"
            >
              ออกจากระบบ
            </Link>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 relative">
        <StaffSideRail />
        <main className="md:ml-[80px]">{children}</main>
      </div>
    </div>
  );
}