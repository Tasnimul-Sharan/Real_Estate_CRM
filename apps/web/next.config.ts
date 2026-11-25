import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = process.env.VERCEL
  ? {}
  : {
      output: 'standalone',
      outputFileTracingRoot: path.resolve(__dirname),
    };

export default nextConfig;
