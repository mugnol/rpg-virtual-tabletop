import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/globalSetup.ts"],
    setupFiles: ["tests/setupFiles.ts"],
    // One database file shared by all integration tests: run them in a single
    // fork so Prisma/SQLite never contend on the file lock.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 20000,
    hookTimeout: 120000,
  },
});
