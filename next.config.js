// next.config.js
/** @type {import('next').NextConfig} */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let SUPABASE_HOST = '';
try {
  if (SUPABASE_URL) {
    SUPABASE_HOST = new URL(SUPABASE_URL).hostname; // eg. ofmjurmxhtyjejgoxwhq.supabase.co
  }
} catch (e) {
  // ignore invalid URL at build time
}

const nextConfig = {
  reactStrictMode: true,
  images: {
    // ใช้ remotePatterns เพื่อจำกัดเฉพาะ path public storage
    remotePatterns: SUPABASE_HOST
      ? [
          {
            protocol: 'https',
            hostname: SUPABASE_HOST,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
    // เผื่อกรณีคุณอยากใช้ domains แบบง่าย ๆ ก็ได้ (คอมเมนต์ทิ้งไว้)
    // domains: SUPABASE_HOST ? [SUPABASE_HOST] : [],
  },
  // เปิดให้ใช้ environment variables ฝั่ง client ได้ตามปกติ
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  },
};

module.exports = nextConfig;
