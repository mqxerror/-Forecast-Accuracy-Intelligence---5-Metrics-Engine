import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
    // Increase body size limit for route handlers (Next.js 16+)
    proxyClientMaxBodySize: '100mb',
  },
};

export default nextConfig;
