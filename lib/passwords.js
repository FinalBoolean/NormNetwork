import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

// scrypt is built into Node, so there are no native modules to compile.
// Parameters are stored with each hash, so they can be raised later without
// breaking existing accounts.
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/**
 * Hash a password for storage in users.password_hash.
 * Format: scrypt$N$r$p$<salt base64>$<hash base64>
 */
export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt, KEY_LENGTH, PARAMS);
  const { N, r, p } = PARAMS;
  return ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
}

/** Check a password against a stored hash. Returns false for malformed hashes. */
export async function verifyPassword(password, stored) {
  const parts = typeof stored === "string" ? stored.split("$") : [];
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every(Number.isInteger)) return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (!expected.length) return false;
  try {
    const actual = await scryptAsync(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: 256 * N * r,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// Used when a login names an account that doesn't exist, so that request takes
// as long as a wrong password and response timing doesn't reveal which accounts exist.
let dummyHash;
export async function burnPasswordCheck(password) {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await dummyHash);
  return false;
}
