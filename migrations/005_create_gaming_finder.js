import { sql } from "kysely";

export async function up(db) {
  await db.schema
    .createTable("gaming_finder")
    .addColumn("user_id", "integer", (col) =>
      col.primaryKey().references("profiles.user_id").onDelete("cascade"),
    )
    .addColumn("games", "text", (col) => col.notNull())
    .addColumn("rank", "text")
    .addColumn("main_character", "text")
    .addColumn("main_role", "text")
    .execute();
}

export async function down(db) {
  await db.schema.dropTable("gaming_finder").ifExists().execute();
}
