import "./env.js";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { seedBuiltinSystems } from "../src/rules/builtin.js";

const prismaDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../prisma");

export default async function globalSetup() {
  for (const suffix of ["", "-journal"]) {
    rmSync(path.join(prismaDir, `test.db${suffix}`), { force: true });
  }
  execSync("npx prisma db push --skip-generate", {
    cwd: prismaDir,
    stdio: ["ignore", "ignore", "pipe"],
  });
  const prisma = new PrismaClient();
  try {
    await seedBuiltinSystems(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
