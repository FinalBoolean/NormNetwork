import type { Request } from "express";
import type { Kysely, Selectable } from "kysely";
import type { Database } from "../db/types.js";
import type { DiscoveryPerson } from "../src/discovery.js";
import { HttpError } from "../middleware/errors.js";
import { PHOTO_URL } from "./profile-photo.js";

export function discoveryContext(req: Request) {
  if (!req.user) throw new HttpError(401, "You need to log in first.");
  const db = req.app.locals.db;
  if (!db) throw new HttpError(503, "Connections are unavailable: the database isn't connected.");
  return { db, userId: req.user.id };
}

export const wantsJson = (req: Request) =>
  req.is("application/json") || req.accepts(["html", "json"]) === "json";

export function positiveId(value: unknown, label = "Profile ID") {
  const number = typeof value === "number" ? value
    : typeof value === "string" && /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < 1 || number > 2147483647)
    throw new HttpError(400, `${label} must be a positive integer.`);
  return number;
}

export function returnPath(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  // Only these local pages may receive a form redirect, including search/page state.
  if (/^\/(discover|friends)(\?[^\r\n#\\]*)?$/.test(value)) return value;
  return fallback;
}

export const ownProfile = (db: Kysely<Database>, userId: number) =>
  db.selectFrom("profiles").select("id").where("user_id", "=", userId).executeTakeFirst();

export function peopleQuery(db: Kysely<Database>) {
  return db.selectFrom("profiles")
    .innerJoin("users", "users.id", "profiles.user_id")
    .select([
      "profiles.id as profileId", "users.username", "profiles.age", "profiles.class",
      "profiles.major", "profiles.bio", "profiles.profile_picture as profilePicture",
    ]);
}

type PersonRow = Awaited<ReturnType<ReturnType<typeof peopleQuery>["execute"]>>[number];

export function profilePhotoUrl(profileId: number, profilePicture: string | null) {
  if (profilePicture === PHOTO_URL) return `/discover/${profileId}/photo`;
  if (!profilePicture) return null;
  try {
    const url = new URL(profilePicture);
    if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password)
      return profilePicture;
  } catch { /* Older invalid values use the initials fallback. */ }
  return null;
}

export async function relationships(db: Kysely<Database>, profileId: number) {
  const friends = await db.selectFrom("friends").selectAll()
    .where((eb) => eb.or([eb("profile_a_id", "=", profileId), eb("profile_b_id", "=", profileId)]))
    .execute();
  const requests = await db.selectFrom("friend_request").selectAll()
    .where("status", "=", "pending")
    .where((eb) => eb.or([eb("sender_id", "=", profileId), eb("receiver_id", "=", profileId)]))
    .orderBy("id", "desc").execute();
  return { friends, requests };
}

export function presentPerson(
  person: PersonRow,
  profileId?: number,
  relations: { friends: Selectable<Database["friends"]>[]; requests: Selectable<Database["friend_request"]>[] } = { friends: [], requests: [] },
): DiscoveryPerson {
  const friend = relations.friends.some((row) =>
    row.profile_a_id === person.profileId || row.profile_b_id === person.profileId);
  const request = relations.requests.find((row) =>
    row.sender_id === person.profileId || row.receiver_id === person.profileId);
  return {
    ...person,
    profilePicture: profilePhotoUrl(person.profileId, person.profilePicture),
    connection: friend ? "friends" : request ? request.sender_id === profileId ? "sent" : "incoming" : "none",
    requestId: !friend && request ? request.id : null,
  };
}
