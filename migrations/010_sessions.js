import { sql } from "kysely";

// Login sessions, plus case-insensitive username uniqueness for sign-up.
export async function up(db) {
  await db.schema
    .createTable("sessions")
    // SHA-256 of the cookie token. The raw token is never stored, so a leaked
    // sessions table can't be used to hijack accounts.
    .addColumn("token_hash", "text", (col) => col.primaryKey())
    .addColumn("user_id", "integer", (col) =>
      col.references("users.id").onDelete("cascade").notNull(),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("sessions_user_id_idx")
    .on("sessions")
    .column("user_id")
    .execute();

  // "Alice" and "alice" count as the same username.
  await db.schema
    .createIndex("users_username_lower_key")
    .on("users")
    .unique()
    .expression(sql`lower(username)`)
    .execute();
}

export async function down(db) {
  await db.schema.dropIndex("users_username_lower_key").ifExists().execute();
  await db.schema.dropTable("sessions").ifExists().execute();
}
