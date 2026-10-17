/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server in .next/standalone (node server.js), no external platform needed.
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // The learner's files are read at runtime from COACH_DATA_DIR / data/, never bundled.
  outputFileTracingExcludes: { '*': ['./data/**'] },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
