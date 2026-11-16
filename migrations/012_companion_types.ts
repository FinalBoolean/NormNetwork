import type { Kysely } from "kysely";
import { sql } from "kysely";

// What each student is looking for: friends, study, gaming, and/or dating.
export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("companion_types")
    .addColumn("user_id", "integer", (col) =>
      col.references("profiles.user_id").onDelete("cascade").notNull(),
    )
    .addColumn("type", "varchar(20)", (col) => col.notNull())
    .addPrimaryKeyConstraint("companion_types_pk", ["user_id", "type"])
    .addCheckConstraint(
      "companion_types_type_check",
      sql`type in ('friends', 'study', 'gaming', 'dating')`,
    )
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("companion_types").ifExists().execute();
}
