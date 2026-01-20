import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
  async rewrites() {
    return [
      {
        source: "/calendar",
        destination: "/events?module=calendar",
      },
      {
        source: "/management",
        destination: "/home?module=management",
      },
    ];
  },
};

export default nextConfig;
