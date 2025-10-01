// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
//import "./globals.css";

// โหลดฟอนต์จาก Google Fonts (Next.js auto optimize)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ข้อมูล metadata ของระบบ
export const metadata: Metadata = {
  title: "Publication Management",
  description: "ระบบจัดการผลงานตีพิมพ์",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      {/* Next.js จะจัดการ <head> ให้อัตโนมัติ */}
      <head />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}