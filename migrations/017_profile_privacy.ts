import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .alterTable("profiles")
    .addColumn("visibility", "varchar(20)", (col) =>
      col.notNull().defaultTo("private"),
    )
    .addColumn("show_age", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("show_gender", "boolean", (col) =>
      col.notNull().defaultTo(true),
    )
    .addColumn("show_bio", "boolean", (col) => col.notNull().defaultTo(true))
    .execute();

  await db.schema
    .alterTable("profiles")
    .addCheckConstraint(
      "profiles_visibility_check",
      sql`visibility in ('campus', 'friends', 'private')`,
    )
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema
    .alterTable("profiles")
    .dropConstraint("profiles_visibility_check")
    .execute();
  await db.schema
    .alterTable("profiles")
    .dropColumn("show_bio")
    .dropColumn("show_gender")
    .dropColumn("show_age")
    .dropColumn("visibility")
    .execute();
}
