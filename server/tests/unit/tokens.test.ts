import { describe, expect, it } from "vitest";
import {
  generateInviteToken,
  signSessionToken,
  verifySessionToken,
} from "../../src/lib/tokens.js";

describe("session tokens", () => {
  it("round-trips a user id", async () => {
    const token = await signSessionToken("user-123");
    await expect(verifySessionToken(token)).resolves.toBe("user-123");
  });

  it("rejects a tampered token", async () => {
    const token = await signSessionToken("user-123");
    const tampered = token.slice(0, -3) + (token.endsWith("aaa") ? "bbb" : "aaa");
    await expect(verifySessionToken(tampered)).rejects.toThrow();
  });

  it("rejects garbage input", async () => {
    await expect(verifySessionToken("not.a.token")).rejects.toThrow();
  });
});

describe("invite tokens", () => {
  it("is 24 URL-safe characters", () => {
    const token = generateInviteToken();
    expect(token).toHaveLength(24);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateInviteToken()));
    expect(tokens.size).toBe(1000);
  });
});
