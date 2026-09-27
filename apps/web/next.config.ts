import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @mosaic/contracts is TypeScript source in shared/ts, linked with file:, so Next compiles it, and Turbopack's
  // root must include both apps/web and shared/ts (the repo root) to resolve the link.
  transpilePackages: ["@mosaic/contracts"],
  turbopack: { root: path.join(__dirname, "..", "..") },
};

export default nextConfig;
