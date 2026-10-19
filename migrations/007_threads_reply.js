import { sql } from "kysely";

export async function up(db) {
  await db.schema
    .createTable("threads_reply")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("thread_id", "integer", (col) =>
      col.references("threads.id").onDelete("cascade").notNull(),
    )
    .addColumn("profile_id", "integer", (col) =>
      col.references("profiles.id").onDelete("cascade").notNull(),
    )
    .addColumn("body", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();
}

export async function down(db) {
  await db.schema.dropTable("threads_reply").ifExists().execute();
}
