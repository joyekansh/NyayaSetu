import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone', // keeps infra/Dockerfile.frontend small — Divyansh's build
};

export default nextConfig;
