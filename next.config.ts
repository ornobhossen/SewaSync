import type { NextConfig } from 'next';

/**
 * SewaSync ships as a fully static export: no API route, no server action,
 * no runtime backend. `output: 'export'` produces the `out/` directory that
 * is what Vercel serves and what runs with the network disabled.
 */
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
