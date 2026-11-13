import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { COMPANION_TYPES, type CompanionType } from "../src/companions.js";

type Db = Kysely<Database>;

export const sortCompanionTypes = (types: string[]): CompanionType[] =>
  COMPANION_TYPES.filter((type) => types.includes(type));

export async function companionTypesFor(db: Db, userId: number) {
  const rows = await db
    .selectFrom("companion_types")
    .select("type")
    .where("user_id", "=", userId)
    .execute();
  return sortCompanionTypes(rows.map((row) => row.type));
}

/** Everything the profile page shows about what a student is looking for. */
export async function companionData(db: Db, userId: number) {
  const [companionTypes, studyProfile] = await Promise.all([
    companionTypesFor(db, userId),
    db
      .selectFrom("study_finder")
      .selectAll()
      .where("user_id", "=", userId)
      .executeTakeFirst(),
  ]);
  return {
    companionTypes,
    studyProfile: studyProfile ?? null,
  };
}

/** Turns dating off, e.g. when age drops below 18. */
export async function clearDating(db: Db, userId: number) {
  await db
    .deleteFrom("companion_types")
    .where("user_id", "=", userId)
    .where("type", "=", "dating")
    .execute();
}
