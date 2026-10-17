/** @type {import('next').NextConfig} */
const nextConfig = {
  // Plain HTML/JS/CSS in out/, served by any web host; api.php does the server work.
  output: 'export',
  // Build for a sub-folder (e.g. /coach) with BASE_PATH=/coach npm run build; default is the domain root.
  basePath: process.env.BASE_PATH || '',
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
