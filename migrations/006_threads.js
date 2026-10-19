import { sql } from "kysely";

export async function up(db) {
  await db.schema
    .createTable("threads")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("profile_id", "integer", (col) =>
      col.references("profiles.id").onDelete("cascade").notNull(),
    )
    .addColumn("category", "varchar(255)", (col) => col.notNull())
    .addColumn("title", "varchar(100)", (col) => col.notNull())
    .addColumn("body", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();
}

export async function down(db) {
  await db.schema.dropTable("threads").ifExists().execute();
}
