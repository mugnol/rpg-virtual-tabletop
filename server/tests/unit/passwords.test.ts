import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/lib/passwords.js";

describe("password hashing", () => {
  it("does not store the plaintext in the hash", async () => {
    const hash = await hashPassword("super-secret-1");
    expect(hash).not.toContain("super-secret-1");
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("salts: the same password yields different hashes", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toEqual(b);
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    await expect(verifyPassword("correct-horse-battery", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});
