import type { Kysely } from "kysely";

// Gaming partner profile details shown on the Gaming Partner Finder design.
// Nullable so existing rows stay valid; the app requires values on save.
export async function up(db: Kysely<unknown>) {
  await db.schema
    .alterTable("gaming_finder")
    .addColumn("platforms", "text")
    .addColumn("play_style", "varchar(20)")
    .addColumn("voice_chat", "varchar(20)")
    .addColumn("availability", "text")
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema
    .alterTable("gaming_finder")
    .dropColumn("platforms")
    .dropColumn("play_style")
    .dropColumn("voice_chat")
    .dropColumn("availability")
    .execute();
}
