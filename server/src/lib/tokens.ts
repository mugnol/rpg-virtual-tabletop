import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { config } from "../config.js";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(config.jwtSecret);
}

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${config.sessionTtlSeconds}s`)
    .sign(secretKey());
}

/** Returns the user id encoded in the token; throws if invalid or expired. */
export async function verifySessionToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secretKey());
  if (!payload.sub) {
    throw new Error("Session token has no subject");
  }
  return payload.sub;
}

/** 24 URL-safe characters (base64url of 18 random bytes). */
export function generateInviteToken(): string {
  return randomBytes(18).toString("base64url");
}
