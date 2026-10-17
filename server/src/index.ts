import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();

app.listen(config.port, () => {
  console.log(
    `[server] RPG Virtual Tabletop listening on http://localhost:${config.port} (env: ${config.nodeEnv})`,
  );
});
