import { fileURLToPath } from "node:url";

// Plain JavaScript, so the production image can load it without TypeScript installed.
const root = fileURLToPath(new URL(".", import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  // Playwright runs its own dev server next to `pnpm dev`; two servers cannot share one build directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // A stray lockfile in a parent directory makes Next guess the wrong workspace root; pin it to this repo.
  outputFileTracingRoot: root,
  turbopack: { root },
};

export default nextConfig;
