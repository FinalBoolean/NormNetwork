import type { Kysely } from "kysely";
import { sql } from "kysely";
 
export async function up(db: Kysely<unknown>) {
  await sql`
    ALTER TABLE friend_request
      ADD CONSTRAINT friend_request_status
        CHECK (status IN ('pending', 'accepted', 'declined')),
      ADD CONSTRAINT friend_request_not_self
        CHECK (sender_id <> receiver_id)
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX friend_request_pending_pair
      ON friend_request (
        LEAST(sender_id, receiver_id),
        GREATEST(sender_id, receiver_id)
      )
      WHERE status = 'pending'
  `.execute(db);
}
 
export async function down(db: Kysely<unknown>) {
  await sql`DROP INDEX IF EXISTS friend_request_pending_pair`.execute(db);
  await sql`
    ALTER TABLE friend_request
      DROP CONSTRAINT IF EXISTS friend_request_not_self,
      DROP CONSTRAINT IF EXISTS friend_request_status
  `.execute(db);
}
 