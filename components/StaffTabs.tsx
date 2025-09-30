// components/StaffTabs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TabItem = { href: string; label: string; icon?: string };

export default function StaffTabs({ items }: { items: TabItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 py-2">
      {items.map((it) => {
        const active =
          pathname === it.href ||
          (it.href !== "/staff/dashboard" && pathname.startsWith(it.href));

        return (
          <Link
            key={it.href}
            href={it.href}
            className={[
              "px-3 py-2 rounded-lg text-sm transition-all",
              active
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200",
            ].join(" ")}
          >
            <span className="mr-1">{it.icon}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}