import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,  // ข้าม ESLint ตอนโปรดักชันบิลด์
  },
  // ถ้าอยากให้ไม่ตกเพราะ TypeScript error ด้วย (ชั่วคราว) ให้ uncomment บรรทัดนี้:
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
