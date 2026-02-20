import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/big2',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
