import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedBuiltinSystems } from "../src/rules/builtin.js";
import { seedBuiltinThemes } from "../src/modules/themes/service.js";

const prisma = new PrismaClient();

async function main() {
  await seedBuiltinSystems(prisma);
  await seedBuiltinThemes(prisma);

  const passwordHash = await bcrypt.hash("password123", 10);

  const gm = await prisma.user.upsert({
    where: { email: "gm@example.com" },
    update: {},
    create: { email: "gm@example.com", passwordHash, displayName: "Demo GM", role: "GM" },
  });
  await prisma.user.upsert({
    where: { email: "player@example.com" },
    update: {},
    create: { email: "player@example.com", passwordHash, displayName: "Demo Player", role: "PLAYER" },
  });

  const existing = await prisma.campaign.findFirst({ where: { ownerId: gm.id } });
  if (!existing) {
    await prisma.campaign.create({
      data: {
        name: "Demo Campaign",
        description: "Created by npm run db:seed — safe to delete.",
        system: "shadowdark",
        ownerId: gm.id,
      },
    });
  }
  console.log("[seed] Built-in systems + demo users gm@example.com / player@example.com (password: password123)");
}

main().finally(() => prisma.$disconnect());
