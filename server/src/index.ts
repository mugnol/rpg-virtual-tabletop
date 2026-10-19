import { createApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db.js";

const app = createApp();

app.listen(config.port, async () => {
  console.log(
    `[server] RPG Virtual Tabletop listening on http://localhost:${config.port} (env: ${config.nodeEnv})`,
  );
  try {
    const count = await prisma.systemConfig.count();
    if (count === 0) {
      console.warn(
        "[server] Warning: SystemConfig table is empty. Run `npm run db:seed` to install built-in systems.",
      );
    }
  } catch {
    // Ignore DB readiness errors on boot log
  }
});
