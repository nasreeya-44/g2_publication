import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,  // ← ข้าม ESLint ตอน build (โปรดักชัน)
  },
  // ถ้ามี type error จริง ๆ ไม่อยากให้ตก build ก็เพิ่มบรรทัดด้านล่าง (ชั่วคราว)
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;