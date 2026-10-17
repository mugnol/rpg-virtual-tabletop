import request from "supertest";
import { app } from "../src/app.js";

export const TEST_PASSWORD = "password123";

export type ApiAgent = ReturnType<typeof request.agent>;

/** Register a user via the API and return a cookie-preserving supertest agent. */
export async function registerAgent(
  email: string,
  role: "GM" | "PLAYER" = "GM",
  displayName = "Test User",
): Promise<ApiAgent> {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/register").send({
    email,
    password: TEST_PASSWORD,
    displayName,
    role,
  });
  if (res.status !== 201) {
    throw new Error(`registerAgent(${email}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

/** Fresh unauthenticated supertest client. */
export const guest = () => request(app);
