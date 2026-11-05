import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Creates a small self-contained server in .next/standalone for hosting.
  output: "standalone",
  serverExternalPackages: ["node:sqlite"],
};

export default nextConfig;
