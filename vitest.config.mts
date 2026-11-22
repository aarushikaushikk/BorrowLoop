import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolves the `@/*` → `./src/*` alias from tsconfig.json.
  plugins: [tsconfigPaths()],
  test: {
    // Unit tests target server-side logic (guards, validation, domain rules),
    // so they run in Node rather than a browser-like DOM environment.
    environment: "node",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Server modules, shared validation, and the proxy. Pages and layouts
      // are covered by end-to-end tests instead (Vitest can't render async
      // Server Components).
      include: ["src/server/**/*.ts", "src/lib/**/*.ts", "src/proxy.ts"],
      exclude: ["src/**/*.test.ts", "src/test/**"],
      // The 70% threshold (docs/testing.md) is enforced once application
      // tests exist.
    },
  },
});
