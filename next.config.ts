import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone (used by the Dockerfile; Vercel ignores it).
  output: "standalone",
  // Embedded Postgres used for local development only.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
