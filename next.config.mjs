/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  // Vercel serverless functions are minimal — we have to tell Next to ship
  // the SQLite file alongside every server function that reads from it.
  // Keys are matched against route paths; '*' is a wildcard catch-all.
  outputFileTracingIncludes: {
    "*": ["./data/aurora.db"],
  },
};

export default nextConfig;
