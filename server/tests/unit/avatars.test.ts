import { describe, expect, it } from "vitest";
import {
  getPredefinedAvatar,
  getPredefinedAvatars,
  resolveTokenAvatar,
} from "../../src/rules/avatars.js";

describe("Predefined Token Avatars Catalog & Auto-assignment (BR-39)", () => {
  it("provides predefined avatars for all Shadowdark classes and generic monster roles", () => {
    const avatars = getPredefinedAvatars();
    expect(avatars.length).toBeGreaterThanOrEqual(10);

    const keys = avatars.map((a) => a.key);
    // Classes & Level 0
    expect(keys).toContain("peasant");
    expect(keys).toContain("fighter");
    expect(keys).toContain("priest");
    expect(keys).toContain("thief");
    expect(keys).toContain("wizard");

    // Generic monster roles
    expect(keys).toContain("mook");
    expect(keys).toContain("soldier");
    expect(keys).toContain("striker");
    expect(keys).toContain("tank");
    expect(keys).toContain("controller");
    expect(keys).toContain("legendary");

    // Common monster types
    expect(keys).toContain("goblin");
    expect(keys).toContain("skeleton");
    expect(keys).toContain("zombie");
    expect(keys).toContain("dragon");
  });

  it("can look up an avatar by key", () => {
    const fighter = getPredefinedAvatar("fighter");
    expect(fighter).toBeDefined();
    expect(fighter?.name).toBe("Fighter");
    expect(fighter?.category).toBe("class");
    expect(fighter?.url).toBe("/avatars/fighter.svg");

    const nonExistent = getPredefinedAvatar("unknown-xyz");
    expect(nonExistent).toBeUndefined();
  });

  it("resolves explicit avatarKey and custom imageUrl", () => {
    // Explicit avatarKey
    const byKey = resolveTokenAvatar({
      type: "CHARACTER",
      avatarKey: "wizard",
    });
    expect(byKey.avatarKey).toBe("wizard");
    expect(byKey.imageUrl).toBe("/avatars/wizard.svg");

    // Explicit custom imageUrl
    const byUrl = resolveTokenAvatar({
      type: "CHARACTER",
      imageUrl: "https://example.com/custom-hero.png",
    });
    expect(byUrl.avatarKey).toBeNull();
    expect(byUrl.imageUrl).toBe("https://example.com/custom-hero.png");

    // Explicit custom data URL
    const dataUrl = "data:image/svg+xml;utf8,<svg></svg>";
    const byData = resolveTokenAvatar({
      type: "CHARACTER",
      imageUrl: dataUrl,
      avatarKey: "custom",
    });
    expect(byData.avatarKey).toBe("custom");
    expect(byData.imageUrl).toBe(dataUrl);
  });

  it("auto-assigns avatar for Character sheets based on classId and level", () => {
    // Fighter class
    const fighter = resolveTokenAvatar({
      type: "CHARACTER",
      characterClassId: "fighter",
      characterLevel: 1,
    });
    expect(fighter.avatarKey).toBe("fighter");
    expect(fighter.imageUrl).toBe("/avatars/fighter.svg");

    // Wizard class
    const wizard = resolveTokenAvatar({
      type: "CHARACTER",
      characterClassId: "wizard",
      characterLevel: 2,
    });
    expect(wizard.avatarKey).toBe("wizard");
    expect(wizard.imageUrl).toBe("/avatars/wizard.svg");

    // Level 0 peasant
    const peasant = resolveTokenAvatar({
      type: "CHARACTER",
      characterClassId: null,
      characterLevel: 0,
    });
    expect(peasant.avatarKey).toBe("peasant");
    expect(peasant.imageUrl).toBe("/avatars/peasant.svg");
  });

  it("auto-assigns avatar for Monsters based on compendium key or combat role", () => {
    // Monster compendium key
    const goblin = resolveTokenAvatar({
      type: "MONSTER",
      monsterKey: "goblin",
    });
    expect(goblin.avatarKey).toBe("goblin");
    expect(goblin.imageUrl).toBe("/avatars/goblin.svg");

    // Monster compendium skeleton
    const skeleton = resolveTokenAvatar({
      type: "MONSTER",
      monsterKey: "skeleton",
    });
    expect(skeleton.avatarKey).toBe("skeleton");
    expect(skeleton.imageUrl).toBe("/avatars/skeleton.svg");

    // Monster combat role: Tank
    const tank = resolveTokenAvatar({
      type: "MONSTER",
      monsterRole: "Tank",
    });
    expect(tank.avatarKey).toBe("tank");
    expect(tank.imageUrl).toBe("/avatars/tank.svg");

    // Monster combat role: Controller
    const controller = resolveTokenAvatar({
      type: "MONSTER",
      monsterRole: "Controller",
    });
    expect(controller.avatarKey).toBe("controller");
    expect(controller.imageUrl).toBe("/avatars/controller.svg");
  });
});
