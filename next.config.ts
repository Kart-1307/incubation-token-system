import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(import.meta.dirname),
  devIndicators: false,
  allowedDevOrigins: ['*.loca.lt', '*.ngrok-free.app', 'localhost:3000'],
};

export default nextConfig;
