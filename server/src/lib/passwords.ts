import bcrypt from "bcryptjs";

const ROUNDS = 10;

// Compared against when the user does not exist, so login timing does not
// reveal whether an email is registered (the error message is generic either way).
const DUMMY_HASH = bcrypt.hashSync("not-the-actual-password", ROUNDS);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function dummyHash(): string {
  return DUMMY_HASH;
}
