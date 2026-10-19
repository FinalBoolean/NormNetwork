import { sql } from "kysely";

export async function up(db) {
  await db.schema
    .createTable("friend_request")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("sender_id", "integer", (col) =>
      col.references("profiles.id").onDelete("cascade").notNull(),
    )
    .addColumn("receiver_id", "integer", (col) =>
      col.references("profiles.id").onDelete("cascade").notNull(),
    )
    .addColumn("status", "varchar(30)", (col) =>
      col.defaultTo("pending").notNull(),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();
}

export async function down(db) {
  await db.schema.dropTable("friend_request").ifExists().execute();
}
