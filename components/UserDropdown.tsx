"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

type User = {
  name: string;
  role: string;          // "ADMIN" | "STAFF" | ...
  image?: string | null; // URL avatar
};

type Props = {
  user: User;
  profileHref?: string;   // default: /staff/profile
  logoutHref?: string;    // default: /api/logout (POST)
};

export default function UserDropdown({
  user,
  profileHref = "/staff/profile",
  logoutHref = "/api/logout",
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // ปิด dropdown เมื่อคลิกนอก/กด Esc
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const avatarSrc = user.image || "/avatar.png";

  return (
    <div className="relative" ref={wrapRef}>
      {/* ปุ่มด้านบน (การ์ดโค้งมน + เงา) */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 rounded-2xl bg-white border border-gray-200 px-3 py-2 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.25)] hover:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.28)] transition"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <img
          src={avatarSrc}
          alt={user.name}
          className="w-9 h-9 rounded-full object-cover"
        />
        <div className="text-left leading-tight">
          <div className="text-gray-900 font-semibold text-sm">{user.name}</div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            {user.role}
          </div>
        </div>
      </button>

      {/* เมนูป็อปอัป */}
      {open && (
        <div
          role="menu"
          className="
            absolute right-0 mt-3 w-[360px] max-w-[90vw]
            bg-white rounded-[22px] border border-black/60
            shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)] overflow-hidden z-50
          "
        >
          {/* Header โปรไฟล์ */}
          <div className="flex items-center gap-3 px-6 pt-6">
            <img
              src={avatarSrc}
              alt={user.name}
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <div className="text-[18px] font-semibold text-gray-900">
                {user.name}
              </div>
              <div className="text-sm text-gray-500 lowercase">
                {user.role.toLowerCase()}
              </div>
            </div>
          </div>

          {/* ปุ่ม ดูโปรไฟล์ (ขอบดำมน) */}
          <div className="px-6 pt-4">
            <Link
              href={profileHref}
              onClick={() => setOpen(false)}
              className="
                block w-full text-center rounded-2xl
                border-2 border-black/70 py-3
                text-[18px] font-medium
                hover:bg-gray-50 active:scale-[0.99] transition
              "
            >
              ดูโปรไฟล์
            </Link>
          </div>

          {/* ปุ่ม ออกจากระบบ (พื้นชมพูอ่อน ตัวแดง) */}
          <div className="px-6 py-6">
            <form action="/login" method="post">
              <button
                type="submit"
                className="
                  w-full rounded-2xl py-3 text-[18px] font-semibold
                  bg-red-50 text-red-600 hover:bg-red-100
                  active:scale-[0.99] transition
                "
              >
                ออกจากระบบ
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}