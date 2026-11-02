import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import type { Request, CookieOptions } from "express";
import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "nn_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/**
 * Start a session for a user. Returns the raw token to put in the cookie.
 * Every login gets a brand-new token, which prevents session fixation.
 */
export async function createSession(
  db: Kysely<Database>,
  userId: number,
  now = new Date(),
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  // Tidy up this user's expired sessions while we're here.
  await db
    .deleteFrom("sessions")
    .where("user_id", "=", userId)
    .where("expires_at", "<=", now)
    .execute();
  await db
    .insertInto("sessions")
    .values({
      token_hash: hashToken(token),
      user_id: userId,
      expires_at: expiresAt,
    })
    .execute();
  return { token, expiresAt };
}

/** Look up the user for a session token, or null if missing or expired. */
export async function findSessionUser(
  db: Kysely<Database>,
  token: string | undefined,
  now = new Date(),
) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const row = await db
    .selectFrom("sessions")
    .innerJoin("users", "users.id", "sessions.user_id")
    .select([
      "users.id",
      "users.username",
      "users.email",
      "sessions.expires_at",
    ])
    .where("sessions.token_hash", "=", tokenHash)
    .executeTakeFirst();
  if (!row) return null;
  if (new Date(row.expires_at) <= now) {
    await db
      .deleteFrom("sessions")
      .where("token_hash", "=", tokenHash)
      .execute();
    return null;
  }
  return { id: row.id, username: row.username, email: row.email };
}

export async function deleteSession(
  db: Kysely<Database>,
  token: string | undefined,
) {
  if (!token) return;
  await db
    .deleteFrom("sessions")
    .where("token_hash", "=", hashToken(token))
    .execute();
}

/** Minimal Cookie header parser (avoids pulling in cookie-parser for one cookie). */
export function readCookie(req: Pick<Request, "headers">, name: string) {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function cookieOptions(): CookieOptions {
  return {
    httpOnly: true, // not readable from page JavaScript
    sameSite: "lax", // not sent on cross-site form posts
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
