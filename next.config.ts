import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/temples': ['./src/data/temples.json', './src/data/catalog-meta.json'],
  },
};

export default nextConfig;
