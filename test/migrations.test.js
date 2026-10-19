import assert from "node:assert/strict";
import test from "node:test";
import { Kysely, PostgresDialect } from "kysely";
import { NO_MIGRATIONS } from "kysely/migration";
import { PGlite } from "@electric-sql/pglite";
import { createDatabase } from "../db/index.js";
import { createMigrator } from "../db/migrator.js";

test("migrations apply, enforce relationships, roll back, and reapply", async () => {
  // CI uses a dedicated PostgreSQL service. Locally use an isolated PostgreSQL WASM instance.
  const embedded = process.env.TEST_DATABASE_URL ? null : new PGlite();
  const client = embedded && {
    async query(text, parameters) {
      const result = await embedded.query(text, parameters);
      return { ...result, rowCount: result.affectedRows ?? result.rows.length };
    },
    release() {},
  };
  const db = embedded
    ? new Kysely({
        dialect: new PostgresDialect({
          pool: {
            async connect() {
              return client;
            },
            async end() {
              await embedded.close();
            },
          },
        }),
      })
    : createDatabase(process.env.TEST_DATABASE_URL);
  const migrator = createMigrator(db);
  const check = (result) => {
    if (result.error) throw result.error;
    return result.results;
  };
  try {
    assert.equal(check(await migrator.migrateToLatest()).length, 9);
    assert.equal(check(await migrator.migrateToLatest()).length, 0);
    assert.equal(
      (await migrator.getMigrations()).filter((m) => m.executedAt).length,
      9,
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
    for (const [table, values] of Object.entries({
      friend_finder: { interest: "music", preferred_gender: "any" },
      study_finder: { subject: "CS", course: "ITSC-3155" },
      gaming_finder: { games: "Chess" },
    })) {
      await db
        .insertInto(table)
        .values({ user_id: user.id, ...values })
        .execute();
    }
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
    ]) {
      assert.deepEqual(await db.selectFrom(table).selectAll().execute(), []);
    }
    assert.equal(
      (await db.selectFrom("profiles").selectAll().execute()).length,
      1,
    );
    check(await migrator.migrateDown());
    assert.equal(check(await migrator.migrateToLatest()).length, 1);
    assert.equal(check(await migrator.migrateTo(NO_MIGRATIONS)).length, 9);
    assert.deepEqual(
      (await db.introspection.getTables()).filter(
        (t) => !t.name.startsWith("kysely_"),
      ),
      [],
    );
    assert.equal(check(await migrator.migrateToLatest()).length, 9);
    check(await migrator.migrateTo(NO_MIGRATIONS));
  } finally {
    await db.destroy();
  }
});
