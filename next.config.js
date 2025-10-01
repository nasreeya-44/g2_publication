// next.config.js
/** @type {import('next').NextConfig} */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let SUPABASE_HOST = '';
try {
  if (SUPABASE_URL) {
    // eg. ofmjurmxhtyjejgoxwhq.supabase.co
    SUPABASE_HOST = new URL(SUPABASE_URL).hostname;
  }
} catch {
  // ignore invalid URL at build time
}

const remotePatterns = [];

// อนุญาตรูปจาก Supabase public storage
if (SUPABASE_HOST) {
  remotePatterns.push({
    protocol: 'https',
    hostname: SUPABASE_HOST,
    pathname: '/storage/v1/object/public/**',
  });
}

// อนุญาตรูป avatar ชั่วคราวจาก DiceBear (เช่น https://api.dicebear.com/7.x/thumbs/svg?seed=...)
remotePatterns.push({
  protocol: 'https',
  hostname: 'api.dicebear.com',
  pathname: '/7.x/**',
});

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns,
    // ถ้าต้องการแบบ domains อย่างง่ายก็ใช้บรรทัดล่างแทน (ไม่จำเป็นเมื่อใช้ remotePatterns แล้ว)
    // domains: SUPABASE_HOST ? [SUPABASE_HOST, 'api.dicebear.com'] : ['api.dicebear.com'],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  },
};

module.exports = nextConfig;
