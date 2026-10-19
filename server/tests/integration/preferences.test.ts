import { describe, expect, it } from "vitest";
import { registerAgent } from "../helpers.js";

let seq = 0;

describe("User Preferences API (BR-54, BR-63)", () => {
  it("defaults to medieval theme and en locale upon registration", async () => {
    seq += 1;
    const agent = await registerAgent(`pref-def-${seq}@test.dev`, "PLAYER", "Default Prefs");

    const meRes = await agent.get("/api/auth/me");
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.preferredTheme).toBe("medieval");
    expect(meRes.body.user.preferredLocale).toBe("en");
  });

  it("updates user preferredTheme and preferredLocale", async () => {
    seq += 1;
    const agent = await registerAgent(`pref-update-${seq}@test.dev`, "PLAYER", "Update Prefs");

    const patchRes = await agent.patch("/api/users/me/preferences").send({
      preferredTheme: "cyberpunk",
      preferredLocale: "pt-BR",
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.preferences.preferredTheme).toBe("cyberpunk");
    expect(patchRes.body.preferences.preferredLocale).toBe("pt-BR");

    const meRes = await agent.get("/api/auth/me");
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.preferredTheme).toBe("cyberpunk");
    expect(meRes.body.user.preferredLocale).toBe("pt-BR");
  });

  it("rejects unsupported locale with 400", async () => {
    seq += 1;
    const agent = await registerAgent(`pref-badloc-${seq}@test.dev`, "PLAYER", "Bad Locale");

    const patchRes = await agent.patch("/api/users/me/preferences").send({
      preferredLocale: "de",
    });
    expect(patchRes.status).toBe(400);
    expect(patchRes.body.error.code).toBe("INVALID_LOCALE");
  });

  it("rejects non-existent theme key with 404", async () => {
    seq += 1;
    const agent = await registerAgent(`pref-badtheme-${seq}@test.dev`, "PLAYER", "Bad Theme");

    const patchRes = await agent.patch("/api/users/me/preferences").send({
      preferredTheme: "non-existent-theme-xyz",
    });
    expect(patchRes.status).toBe(404);
    expect(patchRes.body.error.code).toBe("THEME_NOT_FOUND");
  });

  it("maintains isolated preferences between multiple distinct users", async () => {
    seq += 1;
    const agent1 = await registerAgent(`iso-1-${seq}@test.dev`, "PLAYER", "User One");
    const agent2 = await registerAgent(`iso-2-${seq}@test.dev`, "PLAYER", "User Two");

    // User 1 updates preferences to cyberpunk / pt-BR
    await agent1.patch("/api/users/me/preferences").send({
      preferredTheme: "cyberpunk",
      preferredLocale: "pt-BR",
    });

    // User 2 remains default
    const me2 = await agent2.get("/api/auth/me");
    expect(me2.body.user.preferredTheme).toBe("medieval");
    expect(me2.body.user.preferredLocale).toBe("en");

    // User 1 maintains updated preferences
    const me1 = await agent1.get("/api/auth/me");
    expect(me1.body.user.preferredTheme).toBe("cyberpunk");
    expect(me1.body.user.preferredLocale).toBe("pt-BR");
  });
});
