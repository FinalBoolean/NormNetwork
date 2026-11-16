import { sql, type Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { PHOTO_URL } from "./profile-photo.js";
import type {
  HiddenField,
  ProfileVisibility,
  PublicProfile,
} from "../src/profile.js";

export interface ProfileRecord {
  id: number;
  user_id: number;
  username: string;
  profile_picture: string | null;
  bio: string | null;
  age: number;
  class: string;
  gender: string;
  major: string;
  visibility: string;
  show_age: boolean;
  show_gender: boolean;
  show_bio: boolean;
}

function visibilityOf(value: string): ProfileVisibility {
  if (value === "campus" || value === "friends" || value === "private")
    return value;
  // An unexpected stored value stays hidden rather than becoming public.
  return "private";
}

function publicPhoto(profile: ProfileRecord) {
  const picture = profile.profile_picture;
  if (!picture) return null;
  if (picture === PHOTO_URL)
    return `/users/${encodeURIComponent(profile.username)}/photo`;
  try {
    const url = new URL(picture);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Profile another signed-in student is allowed to see.
 * Returns null when the profile is private to that student.
 * The owner always receives every field.
 */
export function presentProfile(
  profile: ProfileRecord,
  viewer: { userId: number; friendProfileIds: ReadonlySet<number> },
): PublicProfile | null {
  const isOwner = profile.user_id === viewer.userId;
  const visibility = visibilityOf(profile.visibility);
  if (!isOwner && visibility === "private") return null;

  const friendsOnly =
    !isOwner && visibility === "friends" && !viewer.friendProfileIds.has(profile.id);
  const hidden: HiddenField[] = [];
  if (!isOwner && (friendsOnly || !profile.show_age)) hidden.push("age");
  if (!isOwner && (friendsOnly || !profile.show_gender)) hidden.push("gender");
  if (!isOwner && (friendsOnly || !profile.show_bio)) hidden.push("bio");

  const person: PublicProfile = {
    username: profile.username,
    major: profile.major,
    class: profile.class,
    profile_picture: publicPhoto(profile),
    hidden,
    friendsOnly,
  };
  if (!hidden.includes("age")) person.age = profile.age;
  if (!hidden.includes("gender")) person.gender = profile.gender;
  if (!hidden.includes("bio")) person.bio = profile.bio;
  return person;
}

const PROFILE_COLUMNS = [
  "profiles.id",
  "profiles.user_id",
  "profiles.profile_picture",
  "profiles.bio",
  "profiles.age",
  "profiles.class",
  "profiles.gender",
  "profiles.major",
  "profiles.visibility",
  "profiles.show_age",
  "profiles.show_gender",
  "profiles.show_bio",
  "users.username",
] as const;

function profileRecords(db: Kysely<Database>) {
  return db
    .selectFrom("profiles")
    .innerJoin("users", "users.id", "profiles.user_id")
    .select(PROFILE_COLUMNS);
}

export async function findProfileRecord(
  db: Kysely<Database>,
  username: string,
): Promise<ProfileRecord | undefined> {
  return profileRecords(db)
    .where(sql<boolean>`lower(users.username) = ${username.toLowerCase()}`)
    .executeTakeFirst();
}

export async function friendProfileIds(db: Kysely<Database>, userId: number) {
  const viewer = await db
    .selectFrom("profiles")
    .select("id")
    .where("user_id", "=", userId)
    .executeTakeFirst();
  const ids = new Set<number>();
  if (!viewer) return ids;
  const rows = await db
    .selectFrom("friends")
    .select(["profile_a_id", "profile_b_id"])
    .where((eb) =>
      eb.or([
        eb("profile_a_id", "=", viewer.id),
        eb("profile_b_id", "=", viewer.id),
      ]),
    )
    .execute();
  for (const row of rows) {
    ids.add(
      row.profile_a_id === viewer.id ? row.profile_b_id : row.profile_a_id,
    );
  }
  return ids;
}

/** Other students' profiles the viewer may open, already filtered by privacy. */
export async function visibleProfiles(
  db: Kysely<Database>,
  userId: number,
  limit: number,
) {
  const rows = await profileRecords(db)
    .where("profiles.user_id", "!=", userId)
    .where("profiles.visibility", "in", ["campus", "friends"])
    .orderBy("profiles.id", "asc")
    .limit(limit)
    .execute();
  const viewer = { userId, friendProfileIds: await friendProfileIds(db, userId) };
  return rows
    .map((row) => presentProfile(row, viewer))
    .filter((person): person is PublicProfile => person !== null);
}
