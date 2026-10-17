// Shared test environment. Imported for side effects by both globalSetup
// (separate process, prepares the database) and setupFiles (test worker,
// runs before any app module is loaded) — so config.ts always sees these.

process.env.NODE_ENV ??= "test";
process.env.JWT_SECRET ??= "test-secret";
process.env.DATABASE_URL ??= "file:./test.db";
