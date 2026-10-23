import { describe, expect, it } from "vitest";
import {
  getMapPreset,
  getMapPresets,
  resolveMapPreset,
} from "../../src/rules/mapPresets.js";

describe("Built-in Map Presets & Resolution (BR-40, UC-40)", () => {
  it("provides built-in Shadowdark map presets for dungeon types, overland hex, and settlement", () => {
    const presets = getMapPresets();
    expect(presets.length).toBeGreaterThanOrEqual(6);

    const keys = presets.map((p) => p.key);
    expect(keys).toContain("cave");
    expect(keys).toContain("tomb");
    expect(keys).toContain("deep-tunnels");
    expect(keys).toContain("ruins");
    expect(keys).toContain("overland-hex");
    expect(keys).toContain("settlement");
  });

  it("can look up a preset by key", () => {
    const tomb = getMapPreset("tomb");
    expect(tomb).toBeDefined();
    expect(tomb?.name).toBe("Ancient Tomb");
    expect(tomb?.category).toBe("dungeon");
    expect(tomb?.url).toBe("/map-presets/tomb.svg");

    const nonExistent = getMapPreset("nonexistent-key");
    expect(nonExistent).toBeUndefined();
  });

  it("resolves presetKey to preset url", () => {
    const resolved = resolveMapPreset({ presetKey: "cave" });
    expect(resolved.presetKey).toBe("cave");
    expect(resolved.imageUrl).toBe("/map-presets/cave.svg");
  });

  it("resolves custom imageUrl when provided", () => {
    const resolved = resolveMapPreset({
      imageUrl: "https://example.com/custom-dungeon.png",
      presetKey: "cave",
    });
    expect(resolved.imageUrl).toBe("https://example.com/custom-dungeon.png");
    expect(resolved.presetKey).toBe("cave");

    const resolvedOnlyUrl = resolveMapPreset({
      imageUrl: "https://example.com/custom-dungeon.png",
    });
    expect(resolvedOnlyUrl.imageUrl).toBe("https://example.com/custom-dungeon.png");
    expect(resolvedOnlyUrl.presetKey).toBeNull();
  });

  it("resolves null when neither imageUrl nor presetKey is provided", () => {
    const resolved = resolveMapPreset({});
    expect(resolved.imageUrl).toBeNull();
    expect(resolved.presetKey).toBeNull();
  });
});
