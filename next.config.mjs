/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export. The deployed view is read-only by design — every page
  // gets pre-rendered at build time with all data baked in. No serverless
  // functions, no runtime DB. Curator workflow runs locally.
  output: "export",
  images: { unoptimized: true },
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
