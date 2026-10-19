import { sql } from "kysely";

export async function up(db) {
  await db.schema
    .createTable("study_finder")
    .addColumn("user_id", "integer", (col) =>
      col.primaryKey().references("profiles.user_id").onDelete("cascade"),
    )
    .addColumn("subject", "text", (col) => col.notNull())
    .addColumn("course", "varchar(255)", (col) => col.notNull())
    .addColumn("additional_info", "text")
    .execute();
}

export async function down(db) {
  await db.schema.dropTable("study_finder").ifExists().execute();
}
