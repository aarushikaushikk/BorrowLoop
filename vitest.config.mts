import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The `@/*` → `./src/*` alias from tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Unit tests target server-side logic (guards, validation, domain rules),
    // so they run in Node rather than a browser-like DOM environment.
    environment: "node",
    include: ["src/**/*.test.ts", "prisma/**/*.test.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Server modules, shared validation, the proxy, Server Actions, and
      // server-rendered content components. Pages and layouts are covered by
      // end-to-end tests instead (Vitest can't render async Server Components
      // inside Suspense).
      include: [
        "src/server/**/*.ts",
        "src/lib/**/*.ts",
        "src/proxy.ts",
        "src/app/**/actions.ts",
        "src/app/**/*-content.tsx",
      ],
      exclude: ["src/**/*.test.ts", "src/test/**", "src/generated/**"],
      // The 70% threshold (docs/testing.md) is enforced once application
      // tests exist.
    },
  },
});
