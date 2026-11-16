import type { Kysely } from "kysely";

// Study partner profile details shown on the Study Buddy Finder design.
export async function up(db: Kysely<unknown>) {
  await db.schema
    .alterTable("study_finder")
    .addColumn("availability", "text")
    .addColumn("meeting_place", "text")
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema
    .alterTable("study_finder")
    .dropColumn("availability")
    .dropColumn("meeting_place")
    .execute();
}
