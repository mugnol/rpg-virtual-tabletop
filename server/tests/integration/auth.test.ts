import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { TEST_PASSWORD, guest, registerAgent } from "../helpers.js";

describe("POST /api/auth/register", () => {
  it("creates a GM account, sets an HttpOnly session cookie, and returns no secrets", async () => {
    const res = await guest().post("/api/auth/register").send({
      email: "gm@test.dev",
      password: TEST_PASSWORD,
      displayName: "Elminster",
      role: "GM",
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: "gm@test.dev",
      displayName: "Elminster",
      role: "GM",
    });
    expect(res.body.user.id).toBeTruthy();
    expect(res.body.user.passwordHash).toBeUndefined();

    const cookies = (res.headers["set-cookie"] as unknown as string[]) ?? [];
    const session = cookies.find((c) => c.startsWith("rpg_session="));
    expect(session).toBeTruthy();
    expect(session).toContain("HttpOnly");
    expect(session).toContain("SameSite=Lax");
  });

  it("creates a Player account", async () => {
    const res = await guest().post("/api/auth/register").send({
      email: "player@test.dev",
      password: TEST_PASSWORD,
      displayName: "Drizzt",
      role: "PLAYER",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("PLAYER");
  });

  it("rejects a duplicate email case-insensitively with 409 EMAIL_TAKEN", async () => {
    await guest().post("/api/auth/register").send({
      email: "dupe@test.dev",
      password: TEST_PASSWORD,
      displayName: "First",
      role: "GM",
    });
    const res = await guest().post("/api/auth/register").send({
      email: "DUPE@Test.Dev",
      password: TEST_PASSWORD,
      displayName: "Second",
      role: "PLAYER",
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects invalid payloads with 400 and per-field details", async () => {
    const res = await guest().post("/api/auth/register").send({
      email: "not-an-email",
      password: "short",
      displayName: "x",
      role: "DM",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(3);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with valid credentials and the cookie unlocks /me", async () => {
    await registerAgent("login@test.dev", "GM", "Logger");
    const res = await guest().post("/api/auth/login").send({
      email: "login@test.dev",
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("login@test.dev");

    const cookies = (res.headers["set-cookie"] as unknown as string[]) ?? [];
    const session = cookies.find((c) => c.startsWith("rpg_session="));
    expect(session).toBeTruthy();

    const me = await guest()
      .get("/api/auth/me")
      .set("Cookie", session!.split(";")[0]);
    expect(me.status).toBe(200);
    expect(me.body.user.displayName).toBe("Logger");
  });

  it("normalizes the email before lookup (Login@Test.Dev matches login@test.dev)", async () => {
    await registerAgent("case@test.dev", "PLAYER", "Caser");
    const res = await guest().post("/api/auth/login").send({
      email: "  CASE@Test.Dev ",
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(200);
  });

  it("returns the same generic 401 for a wrong password and an unknown email", async () => {
    await registerAgent("victim@test.dev", "GM", "Victim");
    const wrongPassword = await guest().post("/api/auth/login").send({
      email: "victim@test.dev",
      password: "wrong-password",
    });
    const unknownEmail = await guest().post("/api/auth/login").send({
      email: "ghost@test.dev",
      password: TEST_PASSWORD,
    });
    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
      expect(res.body.error.message).toBe("Invalid email or password");
    }
  });

  it("rejects a malformed payload with 400", async () => {
    const res = await guest().post("/api/auth/login").send({ email: "nope" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 UNAUTHENTICATED without a session", async () => {
    const res = await guest().get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session: subsequent /me calls return 401", async () => {
    const agent = await registerAgent("logout@test.dev", "PLAYER", "Leaver");
    expect((await agent.get("/api/auth/me")).status).toBe(200);

    const res = await agent.post("/api/auth/logout");
    expect(res.status).toBe(204);

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(401);
  });
});

describe("unknown API routes", () => {
  it("return a JSON 404, not the SPA or HTML", async () => {
    const res = await guest().get("/api/definitely-not-real");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
