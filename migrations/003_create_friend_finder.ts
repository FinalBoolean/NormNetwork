import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("friend_finder")
    .addColumn("user_id", "integer", (col) =>
      col.primaryKey().references("profiles.user_id").onDelete("cascade"),
    )
    .addColumn("interest", "text", (col) => col.notNull())
    .addColumn("preferred_gender", "varchar(30)", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("friend_finder").ifExists().execute();
}
