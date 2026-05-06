/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  // Vercel serverless functions are minimal — we have to tell Next to ship
  // the SQLite file (built by `pnpm vercel:build`) alongside every server
  // function that reads from it. Without this, runtime opens fail with
  // "unable to open database file" because data/aurora.db isn't traced.
  outputFileTracingIncludes: {
    "/**/*": ["./data/aurora.db"],
  },
};

export default nextConfig;
