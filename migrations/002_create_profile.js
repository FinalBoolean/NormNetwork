import { sql } from "kysely";

export async function up(db) {
  await db.schema
    .createTable("profiles")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("user_id", "integer", (col) =>
      col.references("users.id").onDelete("cascade").notNull().unique(),
    )
    .addColumn("profile_picture", "text")
    .addColumn("bio", "text")
    .addColumn("age", "integer", (col) => col.notNull())
    .addColumn("class", "varchar(10)", (col) => col.notNull())
    .addColumn("gender", "varchar(20)", (col) => col.notNull())
    .addColumn("major", "varchar(255)", (col) => col.notNull())
    .execute();
}
export async function down(db) {
  await db.schema.dropTable("profiles").ifExists().execute();
}
