"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

/** ไอคอนแบบ SVG ให้คมกว่าภาพอีโมจิ */
function IconHome(props: any){ return (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path d="M3 10.5 12 3l9 7.5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 9.5V21h14V9.5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)}
function IconCategoryAdd(props: any){ return (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <rect x="4" y="4" width="6" height="6" rx="1.5" strokeWidth="1.8"/>
    <circle cx="15.5" cy="7" r="3" strokeWidth="1.8"/>
    <path d="M15.5 14v6M12 17.5h7" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)}
function IconSearch(props: any){ return (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <circle cx="11" cy="11" r="6.5" strokeWidth="1.8"/>
    <path d="m16.2 16.2 4.3 4.3" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)}
function IconUser(props: any){ return (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <circle cx="12" cy="8" r="3.5" strokeWidth="1.8"/>
    <path d="M4.5 20a7.5 7.5 0 0115 0" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)}
function IconReview(props: any){ return (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path d="M4 7h10m-10 5h7" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="m15.5 12.5 1.8 1.8 3.2-3.2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)}
function IconClock(props: any){ return (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <circle cx="12" cy="12" r="8.5" strokeWidth="1.8"/>
    <path d="M12 7.5V12l3 2" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)}
function IconBook(props: any){ return (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path d="M5 4.5h9.5A2.5 2.5 0 0117 7v12.5H6.5A2.5 2.5 0 014 17V7A2.5 2.5 0 016.5 4.5z" strokeWidth="1.8"/>
    <path d="M17 7h1.5A1.5 1.5 0 0120 8.5V19a1.5 1.5 0 01-1.5 1.5H6.5" strokeWidth="1.8"/>
  </svg>
)}
function IconDoc(props: any){ return (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path d="M7 3.5h7L19 8v12a1.5 1.5 0 01-1.5 1.5H7A1.5 1.5 0 015.5 20V5A1.5 1.5 0 017 3.5z" strokeWidth="1.8"/>
    <path d="M14 3.5V8h4.5" strokeWidth="1.8"/>
  </svg>
)}

type Item = {
  href: string;
  title: string;
  icon: (p: any) => React.ReactNode;
};

const items: Item[] = [
  { href: "/staff/dashboard",         title: "home",                   icon: IconHome },
  { href: "/staff/categories",        title: "จัดการหมวดหมู่",            icon: IconCategoryAdd },
  { href: "/staff/search",            title: "ค้นหางานตีพิมพ์",            icon: IconSearch },
  { href: "/staff/pro",               title: "จัดการข้อมูลส่วนตัว",         icon: IconUser },      // ใช้รูปคนตามภาพ
  { href: "/staff/reviews",            title: "จัดการตรวจสอบงานตีพิมพ์",    icon: IconReview },
  { href: "/staff/history",           title: "ประวัตการแก้ไขผลงาน",      icon: IconClock },
  { href: "/staff/reports",           title: "จัดทำรายงาน",             icon: IconBook },
  { href: "/staff/manual",            title: "ดูคู่มือ",                   icon: IconDoc },       // ถ้าต้องการ 7 ปุ่ม ให้ลบบรรทัดนี้ออก
];

export default function StaffSideRail() {
  const pathname = usePathname();

  return (
    <aside
      className="
        hidden md:block fixed left-6 top-24 z-30
        bg-white border border-[#E6ECF2] rounded-[28px] p-3
        w-[56px]  /* ความกว้างราง */
        shadow-[0_1px_0_#eef2f7_inset]
      "
    >
      <div className="flex flex-col items-center gap-2">
        {items.map((it) => {
          const active =
            pathname === it.href ||
            (it.href !== "/staff/dashboard" && pathname.startsWith(it.href));

          return (
            <Link
              key={it.href}
              href={it.href}
              title={it.title}
              className="
                group relative grid place-items-center
                w-[50px] h-[50px]  /* ขนาดปุ่มวงกลม */
              "
            >
              {/* วงขอบบางเทาอ่อน (เหมือนภาพ) */}
              <span
                className="
                  absolute inset-0 rounded-full border
                  border-[#E6ECF2]
                "
              />
              {/* ปุ่มจริง */}
              <span
                className={`
                  relative z-10 grid place-items-center
                  w-[44px] h-[44px] rounded-full
                  ${active
                    ? "bg-[#1E3A8A] text-white ring-4 ring-[#1E3A8A]/18"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                  }
                  transition-colors
                `}
              >
                {it.icon({
                  className: active ? "w-5 h-5 text-white" : "w-8 h-8 text-slate-600"
                })}
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}