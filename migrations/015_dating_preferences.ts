import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("dating_preferences")
    .addColumn("user_id", "integer", (col) =>
      col.primaryKey().references("profiles.user_id").onDelete("cascade"),
    )
    .addColumn("interested_in", "text", (col) => col.notNull())
    .addColumn("age_min", "integer", (col) => col.notNull())
    .addColumn("age_max", "integer", (col) => col.notNull())
    .addColumn("looking_for", "varchar(40)", (col) => col.notNull())
    // Dating is for adults only, whatever the application code does.
    .addCheckConstraint(
      "dating_preferences_age_range",
      sql`age_min >= 18 and age_max <= 100 and age_min <= age_max`,
    )
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("dating_preferences").ifExists().execute();
}
