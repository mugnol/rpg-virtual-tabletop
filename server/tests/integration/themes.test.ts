import { describe, expect, it } from "vitest";
import { registerAgent } from "../helpers.js";

let seq = 0;

describe("Themes API (BR-51..BR-56)", () => {
  it("lists seeded built-in themes (medieval and cyberpunk)", async () => {
    seq += 1;
    const agent = await registerAgent(`theme-user-${seq}@test.dev`, "PLAYER", "Theme User");

    const res = await agent.get("/api/themes");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.themes)).toBe(true);

    const keys = res.body.themes.map((t: any) => t.key);
    expect(keys).toContain("medieval");
    expect(keys).toContain("cyberpunk");

    const medieval = res.body.themes.find((t: any) => t.key === "medieval");
    expect(medieval.builtin).toBe(true);
  });

  it("gets full theme configuration by key", async () => {
    seq += 1;
    const agent = await registerAgent(`theme-user-${seq}@test.dev`, "PLAYER", "Theme User");

    const res = await agent.get("/api/themes/medieval");
    expect(res.status).toBe(200);
    expect(res.body.theme.key).toBe("medieval");
    expect(res.body.theme.colors.bgPrimary).toBeDefined();
    expect(res.body.theme.typography.fontFamilySans).toBeDefined();
  });

  it("exports theme configuration JSON file", async () => {
    seq += 1;
    const agent = await registerAgent(`theme-user-${seq}@test.dev`, "PLAYER", "Theme User");

    const res = await agent.get("/api/themes/cyberpunk/export");
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("cyberpunk-theme.json");
    const exported = JSON.parse(res.text);
    expect(exported.key).toBe("cyberpunk");
  });

  it("imports a valid custom theme and lists it", async () => {
    seq += 1;
    const agent = await registerAgent(`theme-user-${seq}@test.dev`, "PLAYER", "Theme User");

    const customTheme = {
      key: `custom-synth-${seq}`,
      name: `Custom Synthwave ${seq}`,
      description: "Neon retro 80s synth aesthetic",
      colors: {
        bgPrimary: "#1a0b2e",
        bgSecondary: "#271244",
        bgPanel: "#351a5c",
        textPrimary: "#ffe4f7",
        textSecondary: "#c29ac5",
        accent: "#ff007f",
        accentHover: "#ff3399",
        border: "#5c2d91",
        danger: "#ff3b30",
      },
      typography: {
        fontFamilySans: "system-ui, sans-serif",
        fontFamilyHeading: "'Press Start 2P', cursive",
        fontFamilyMono: "monospace",
      },
      borderRadius: "4px",
    };

    const importRes = await agent.post("/api/themes/import").send(customTheme);
    expect(importRes.status).toBe(201);
    expect(importRes.body.theme.key).toBe(`custom-synth-${seq}`);

    // Verify it appears in GET /api/themes
    const listRes = await agent.get("/api/themes");
    const found = listRes.body.themes.find((t: any) => t.key === `custom-synth-${seq}`);
    expect(found).toBeDefined();
    expect(found.builtin).toBe(false);
  });

  it("rejects importing invalid theme payloads with 422", async () => {
    seq += 1;
    const agent = await registerAgent(`theme-user-${seq}@test.dev`, "PLAYER", "Theme User");

    const invalidTheme = {
      key: "bad-theme",
      name: "Bad Theme",
      colors: {
        bgPrimary: "invalid-hex",
      },
    };

    const res = await agent.post("/api/themes/import").send(invalidTheme);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_THEME_CONFIG");
  });

  it("rejects overwriting built-in themes with 409", async () => {
    seq += 1;
    const agent = await registerAgent(`theme-user-${seq}@test.dev`, "PLAYER", "Theme User");

    const overwritePayload = {
      key: "medieval",
      name: "Fake Medieval",
      colors: {
        bgPrimary: "#000000",
        bgSecondary: "#111111",
        bgPanel: "#222222",
        textPrimary: "#ffffff",
        textSecondary: "#aaaaaa",
        accent: "#ff0000",
        accentHover: "#cc0000",
        border: "#333333",
        danger: "#ff0000",
      },
      typography: {
        fontFamilySans: "sans-serif",
        fontFamilyHeading: "sans-serif",
        fontFamilyMono: "monospace",
      },
      borderRadius: "0px",
    };

    const res = await agent.post("/api/themes/import").send(overwritePayload);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BUILTIN_THEME_PROTECTED");
  });
});
