import type { MigrationResultSet } from "kysely/migration";
import assert from "node:assert/strict";
import test from "node:test";
import { NO_MIGRATIONS } from "kysely/migration";
import { createMigrator } from "../db/migrator.js";
import { createTestDatabase } from "./helpers/db.js";

const MIGRATION_COUNT = 10;

test("migrations apply, enforce relationships, roll back, and reapply", async () => {
  const db = createTestDatabase();
  const migrator = createMigrator(db);
  const check = (result: MigrationResultSet) => {
    if (result.error) throw result.error;
    return result.results ?? [];
  };
  try {
    assert.equal(
      check(await migrator.migrateToLatest()).length,
      MIGRATION_COUNT,
    );
    assert.equal(check(await migrator.migrateToLatest()).length, 0);
    assert.equal(
      (await migrator.getMigrations()).filter((m) => m.executedAt).length,
      MIGRATION_COUNT,
    );
    const user = await db
      .insertInto("users")
      .values({
        username: "alice",
        email: "alice@example.test",
        password_hash: "test-hash",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    assert.ok(user.created_at);
    await assert.rejects(
      db
        .insertInto("users")
        .values({
          username: "duplicate",
          email: user.email,
          password_hash: "test-hash",
        })
        .execute(),
      { code: "23505" },
    );
    // Usernames are unique regardless of case (migration 010)
    await assert.rejects(
      db
        .insertInto("users")
        .values({
          username: "ALICE",
          email: "other-alice@example.test",
          password_hash: "test-hash",
        })
        .execute(),
      { code: "23505" },
    );
    await db
      .insertInto("sessions")
      .values({
        token_hash: "test-token-hash",
        user_id: user.id,
        expires_at: new Date(Date.now() + 60_000),
      })
      .execute();
    await assert.rejects(
      db
        .insertInto("sessions")
        .values({
          token_hash: "orphan",
          user_id: 999999,
          expires_at: new Date(),
        })
        .execute(),
      { code: "23503" },
    );
    await assert.rejects(
      db
        .insertInto("friend_finder")
        .values({
          user_id: user.id,
          interest: "music",
          preferred_gender: "any",
        })
        .execute(),
      { code: "23503" },
    );
    const profileData = {
      user_id: user.id,
      age: 20,
      class: "Junior",
      gender: "Other",
      major: "CS",
    };
    const profile = await db
      .insertInto("profiles")
      .values(profileData)
      .returningAll()
      .executeTakeFirstOrThrow();
    await assert.rejects(
      db.insertInto("profiles").values(profileData).execute(),
      { code: "23505" },
    );
    await db
      .insertInto("friend_finder")
      .values({ user_id: user.id, interest: "music", preferred_gender: "any" })
      .execute();
    await db
      .insertInto("study_finder")
      .values({ user_id: user.id, subject: "CS", course: "ITSC-3155" })
      .execute();
    await db
      .insertInto("gaming_finder")
      .values({ user_id: user.id, games: "Chess" })
      .execute();
    const thread = await db
      .insertInto("threads")
      .values({
        profile_id: profile.id,
        category: "study",
        title: "Hello",
        body: "World",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await db
      .insertInto("threads_reply")
      .values({ thread_id: thread.id, profile_id: profile.id, body: "Reply" })
      .execute();
    const otherUser = await db
      .insertInto("users")
      .values({
        username: "bob",
        email: "bob@example.test",
        password_hash: "test-hash",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    const other = await db
      .insertInto("profiles")
      .values({ ...profileData, user_id: otherUser.id })
      .returningAll()
      .executeTakeFirstOrThrow();
    const request = await db
      .insertInto("friend_request")
      .values({ sender_id: profile.id, receiver_id: other.id })
      .returningAll()
      .executeTakeFirstOrThrow();
    assert.equal(request.status, "pending");
    await db
      .insertInto("friends")
      .values({ profile_a_id: profile.id, profile_b_id: other.id })
      .execute();
    await assert.rejects(
      db
        .insertInto("friends")
        .values({ profile_a_id: other.id, profile_b_id: profile.id })
        .execute(),
      { code: "23514" },
    );
    await assert.rejects(
      db
        .insertInto("friends")
        .values({ profile_a_id: profile.id, profile_b_id: profile.id })
        .execute(),
      { code: "23514" },
    );
    await db.deleteFrom("users").where("id", "=", user.id).execute();
    for (const table of [
      "friend_finder",
      "study_finder",
      "gaming_finder",
      "threads",
      "threads_reply",
      "friend_request",
      "friends",
      "sessions",
    ] as const) {
      assert.deepEqual(await db.selectFrom(table).selectAll().execute(), []);
    }
    assert.equal(
      (await db.selectFrom("profiles").selectAll().execute()).length,
      1,
    );
    check(await migrator.migrateDown());
    assert.equal(check(await migrator.migrateToLatest()).length, 1);
    assert.equal(
      check(await migrator.migrateTo(NO_MIGRATIONS)).length,
      MIGRATION_COUNT,
    );
    assert.deepEqual(
      (await db.introspection.getTables()).filter(
        (t) => !t.name.startsWith("kysely_"),
      ),
      [],
    );
    assert.equal(
      check(await migrator.migrateToLatest()).length,
      MIGRATION_COUNT,
    );
    check(await migrator.migrateTo(NO_MIGRATIONS));
  } finally {
    await db.destroy();
  }
});
