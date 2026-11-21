import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Read directly (not with env()) so `prisma generate` still works in CI
    // without a database URL.
    url: process.env.DATABASE_URL,
  },
});
