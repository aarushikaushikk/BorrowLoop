import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { defineConfig } from "vitest/config";

/**
 * Integration tests (prisma/*.test.ts and other `describe.skipIf(!TEST_DATABASE_URL)`
 * suites) read TEST_DATABASE_URL. Load it from `.env.test` only — never `.env`,
 * which holds real service credentials.
 *
 * - The path is explicit, so a DOTENV_PATH variable can't redirect this to `.env`.
 * - The file is parsed into a throwaway object, not `process.env`, and only
 *   TEST_DATABASE_URL is forwarded to tests, even if more keys are added later.
 * - A value already set in the shell wins over the file.
 * - If `.env.test` is missing, nothing is set and those suites skip as before.
 */
function loadTestDatabaseEnv(): Record<string, string> {
  if (process.env.TEST_DATABASE_URL) {
    return { TEST_DATABASE_URL: process.env.TEST_DATABASE_URL };
  }
  const fromFile: Record<string, string> = {};
  loadDotenv({
    path: fileURLToPath(new URL("./.env.test", import.meta.url)),
    processEnv: fromFile,
    quiet: true,
  });
  return fromFile.TEST_DATABASE_URL ? { TEST_DATABASE_URL: fromFile.TEST_DATABASE_URL } : {};
}

export default defineConfig({
  resolve: {
    // The `@/*` → `./src/*` alias from tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Unit tests target server-side logic (guards, validation, domain rules),
    // so they run in Node rather than a browser-like DOM environment.
    environment: "node",
    env: loadTestDatabaseEnv(),
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
