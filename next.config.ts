/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      // Supabase Storage (เปลี่ยน hostname ให้ตรงกับโปรเจกต์ของคุณ ถ้าไม่ใช่โดเมนนี้)
      {
        protocol: 'https',
        hostname: 'ofmjurmxhtyjejgoxwhq.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // เผื่อ fallback เป็น Dicebear
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
    ],
  },

  // ถ้ามีฟีเจอร์ทดลองอื่น ๆ ค่อยเพิ่มตรงนี้ภายหลังได้
  experimental: {
    // appDir: true, // Next.js 15 ใช้ App Router เป็นค่าเริ่มต้นแล้ว
  },
};

module.exports = nextConfig;
