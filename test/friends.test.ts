import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { NO_MIGRATIONS } from "kysely/migration";
import { createApp } from "../app.js";
import { createMigrator } from "../db/migrator.js";
import { orderedPair } from "../lib/friends.js";
import { createSession, SESSION_COOKIE } from "../lib/sessions.js";
import { createTestDatabase } from "./helpers/db.js";
 
test("sending friend requests", async (t) => {
  const db = createTestDatabase();
  const migrator = createMigrator(db);
  const migration = await migrator.migrateToLatest();
  if (migration.error) throw migration.error;
  const server = createApp({ db }).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
 
  async function account(username: string, withProfile = true) {
    const user = await db
      .insertInto("users")
      .values({
        username,
        email: `${username}@charlotte.edu`,
        password_hash: "unused-in-this-test",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    const { token } = await createSession(db, user.id);
    const profile = withProfile
      ? await db
          .insertInto("profiles")
          .values({
            user_id: user.id,
            age: 20,
            class: "Junior",
            gender: "Other",
            major: "Computer Science",
          })
          .returningAll()
          .executeTakeFirstOrThrow()
      : null;
    return { user, profile, cookie: `${SESSION_COOKIE}=${token}` };
  }
  const alice = await account("fr_alice");
  const bob = await account("fr_bob");
  const carol = await account("fr_carol");
  const dave = await account("fr_dave");
  const erin = await account("fr_erin");
  const frank = await account("fr_frank");
  const noProfile = await account("fr_noprofile", false);
 
  function sendJson(body: unknown, cookie = alice.cookie) {
    return fetch(`${base}/friends/requests`, {
      method: "POST",
      redirect: "manual",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify(body),
    });
  }
  const requestsBetween = (a: number, b: number) =>
    db
      .selectFrom("friend_request")
      .selectAll()
      .where((eb) =>
        eb.or([
          eb.and([eb("sender_id", "=", a), eb("receiver_id", "=", b)]),
          eb.and([eb("sender_id", "=", b), eb("receiver_id", "=", a)]),
        ]),
      )
      .execute();
 
  try {
    await t.test("orderedPair puts the smaller id first", () => {
      assert.deepEqual(orderedPair(5, 2), [2, 5]);
      assert.deepEqual(orderedPair(2, 5), [2, 5]);
    });
 
    await t.test("requires a session", async () => {
      const res = await sendJson({ receiver_id: bob.profile!.id }, "");
      assert.equal(res.status, 401);
    });
 
    await t.test("needs a profile to send a request", async () => {
      const res = await sendJson(
        { receiver_id: bob.profile!.id },
        noProfile.cookie,
      );
      assert.equal(res.status, 409);
    });
 
    await t.test(
      "sends a request from the session user, ignoring a spoofed sender",
      async () => {
        const res = await sendJson({
          receiver_id: bob.profile!.id,
          sender_id: carol.profile!.id,
        });
        assert.equal(res.status, 201);
        const body = await res.json();
        assert.equal(body.sender_id, alice.profile!.id);
        assert.equal(body.receiver_id, bob.profile!.id);
        assert.equal(body.status, "pending");
        assert.equal(
          (await requestsBetween(alice.profile!.id, bob.profile!.id)).length,
          1,
        );
        assert.equal(
          (await requestsBetween(carol.profile!.id, bob.profile!.id)).length,
          0,
        );
      },
    );
 
    await t.test("HTML forms get a redirect and a notice", async () => {
      const res = await fetch(`${base}/friends/requests`, {
        method: "POST",
        redirect: "manual",
        headers: {
          cookie: alice.cookie,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: `receiver_id=${carol.profile!.id}`,
      });
      assert.equal(res.status, 303);
      assert.equal(res.headers.get("location"), "/friends?sent=1");
      const page = await fetch(`${base}/friends?sent=1`, {
        headers: { cookie: alice.cookie },
      });
      assert.equal(page.status, 200);
      assert.match(await page.text(), /Friend request sent\./);
    });
 
    await t.test("rejects missing or malformed receiver ids", async () => {
      for (const receiver_id of [
        undefined,
        null,
        "abc",
        "",
        0,
        -1,
        1.5,
        "1.5",
        99999999999,
        {},
      ])
        assert.equal(
          (await sendJson({ receiver_id })).status,
          400,
          JSON.stringify(receiver_id),
        );
    });
 
    await t.test("404 for a profile that doesn't exist", async () => {
      assert.equal((await sendJson({ receiver_id: 999999 })).status, 404);
    });
 
    await t.test("can't send a request to yourself", async () => {
      const res = await sendJson({ receiver_id: alice.profile!.id });
      assert.equal(res.status, 400);
      assert.equal(
        (await requestsBetween(alice.profile!.id, alice.profile!.id)).length,
        0,
      );
    });
 
    await t.test("blocks duplicates in either direction", async () => {
      const again = await sendJson({ receiver_id: bob.profile!.id });
      assert.equal(again.status, 409);
      assert.match((await again.json()).error, /already sent/);
      const reverse = await sendJson(
        { receiver_id: alice.profile!.id },
        bob.cookie,
      );
      assert.equal(reverse.status, 409);
      assert.match((await reverse.json()).error, /Accept it/);
      assert.equal(
        (await requestsBetween(alice.profile!.id, bob.profile!.id)).length,
        1,
      );
    });
 
    await t.test("simultaneous requests create only one row", async () => {
      const results = await Promise.all([
        sendJson({ receiver_id: erin.profile!.id }, dave.cookie),
        sendJson({ receiver_id: dave.profile!.id }, erin.cookie),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
      assert.equal(
        (await requestsBetween(dave.profile!.id, erin.profile!.id)).length,
        1,
      );
    });
 
    await t.test("can't request someone who is already a friend", async () => {
      const [a, b] = orderedPair(alice.profile!.id, frank.profile!.id);
      await db
        .insertInto("friends")
        .values({ profile_a_id: a, profile_b_id: b })
        .execute();
      assert.equal(
        (await sendJson({ receiver_id: frank.profile!.id })).status,
        409,
      );
      assert.equal(
        (await sendJson({ receiver_id: alice.profile!.id }, frank.cookie))
          .status,
        409,
      );
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    const rollback = await migrator.migrateTo(NO_MIGRATIONS);
    await db.destroy();
    if (rollback.error) throw rollback.error;
  }
});