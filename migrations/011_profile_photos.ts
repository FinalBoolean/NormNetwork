import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("profile_photos")
    .addColumn("profile_id", "integer", (col) =>
      col.primaryKey().references("profiles.id").onDelete("cascade"),
    )
    .addColumn("image", "bytea", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>) {
  // Remove only URLs backed by the table being rolled back.
  await sql`update profiles set profile_picture = null where profile_picture = '/profile/photo'`.execute(
    db,
  );
  await db.schema.dropTable("profile_photos").ifExists().execute();
}
