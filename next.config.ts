import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // Photo uploads (US-2) accept files under 5 MB. The limit counts the raw
      // multipart body, so 6 MB leaves headroom for boundaries and other fields:
      // files between 5 and 6 MB reach our own validation, which rejects them
      // with a clear message instead of a framework error.
      // Security: this raises the parse limit for every Server Action from the
      // 1 MB default. Next parses the body before the action runs, so even an
      // unauthenticated request can make the server read up to 6 MB; each
      // action still authenticates before acting on what it received.
      bodySizeLimit: "6mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
