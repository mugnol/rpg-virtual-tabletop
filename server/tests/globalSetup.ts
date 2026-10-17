import "./env.js";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prismaDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../prisma");

export default function globalSetup() {
  for (const suffix of ["", "-journal"]) {
    rmSync(path.join(prismaDir, `test.db${suffix}`), { force: true });
  }
  execSync("npx prisma db push --skip-generate", {
    cwd: prismaDir,
    stdio: ["ignore", "ignore", "pipe"],
  });
}
