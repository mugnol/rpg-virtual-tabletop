import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { dummyHash, hashPassword, verifyPassword } from "../../lib/passwords.js";
import { ApiError } from "../../middleware/errors.js";
import type { LoginInput, RegisterInput } from "./schemas.js";

export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}

export async function registerUser(input: RegisterInput): Promise<User> {
  try {
    return await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        displayName: input.displayName,
        role: input.role,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists");
    }
    throw error;
  }
}

export async function loginUser(input: LoginInput): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const hash = user ? user.passwordHash : dummyHash();
  const valid = await verifyPassword(input.password, hash);
  if (!user || !valid) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
  return user;
}
