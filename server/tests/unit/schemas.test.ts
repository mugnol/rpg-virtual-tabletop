import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "../../src/modules/auth/schemas.js";
import {
  campaignCreateSchema,
  campaignUpdateSchema,
  joinSchema,
} from "../../src/modules/campaigns/schemas.js";

describe("registerSchema", () => {
  const valid = {
    email: "gm@example.com",
    password: "password123",
    displayName: "Elminster",
    role: "GM",
  };

  it("accepts a valid payload", () => {
    expect(registerSchema.parse(valid)).toEqual(valid);
  });

  it("normalizes email to lowercase with surrounding whitespace trimmed", () => {
    const parsed = registerSchema.parse({ ...valid, email: "  GM@Example.COM  " });
    expect(parsed.email).toBe("gm@example.com");
  });

  it("rejects an unknown role", () => {
    expect(() => registerSchema.parse({ ...valid, role: "DM" })).toThrow();
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(() => registerSchema.parse({ ...valid, password: "1234567" })).toThrow();
  });

  it("rejects a one-character display name", () => {
    expect(() => registerSchema.parse({ ...valid, displayName: "x" })).toThrow();
  });

  it("rejects a malformed email", () => {
    expect(() => registerSchema.parse({ ...valid, email: "not-an-email" })).toThrow();
  });
});

describe("loginSchema", () => {
  it("requires an email and a password", () => {
    expect(() => loginSchema.parse({})).toThrow();
    expect(loginSchema.parse({ email: "a@b.co", password: "x" })).toEqual({
      email: "a@b.co",
      password: "x",
    });
  });
});

describe("campaignCreateSchema", () => {
  it("applies defaults for description and system", () => {
    const parsed = campaignCreateSchema.parse({ name: "Curse of Strahd" });
    expect(parsed).toEqual({ name: "Curse of Strahd", description: "", system: "generic" });
  });

  it("rejects names shorter than 3 characters", () => {
    expect(() => campaignCreateSchema.parse({ name: "ab" })).toThrow();
  });

  it("rejects names longer than 80 characters", () => {
    expect(() => campaignCreateSchema.parse({ name: "x".repeat(81) })).toThrow();
  });

  it("rejects descriptions longer than 500 characters", () => {
    expect(() => campaignCreateSchema.parse({ name: "OK name", description: "x".repeat(501) })).toThrow();
  });

  it("rejects an empty payload", () => {
    expect(() => campaignCreateSchema.parse({})).toThrow();
  });
});

describe("campaignUpdateSchema", () => {
  it("accepts a partial update", () => {
    expect(campaignUpdateSchema.parse({ archived: true })).toEqual({ archived: true });
  });

  it("accepts an empty no-op update", () => {
    expect(campaignUpdateSchema.parse({})).toEqual({});
  });
});

describe("joinSchema", () => {
  it("trims the token", () => {
    expect(joinSchema.parse({ token: "  abcdef  " })).toEqual({ token: "abcdef" });
  });

  it("rejects a missing token", () => {
    expect(() => joinSchema.parse({})).toThrow();
  });
});
