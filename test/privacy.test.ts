import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { sql } from "kysely";
import { NO_MIGRATIONS } from "kysely/migration";
import { createApp } from "../app.js";
import { createMigrator } from "../db/migrator.js";
import { PHOTO_URL } from "../lib/profile-photo.js";
import { createSession, SESSION_COOKIE } from "../lib/sessions.js";
import { createTestDatabase } from "./helpers/db.js";

test("profile privacy rules", async (t) => {
  const db = createTestDatabase();
  const migrator = createMigrator(db);
  const migration = await migrator.migrateToLatest();
  if (migration.error) throw migration.error;
  const server = createApp({ db }).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;

  async function account(username: string) {
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
    return { user, cookie: `${SESSION_COOKIE}=${token}` };
  }

  const alice = await account("privacy_alice");
  const bob = await account("privacy_bob");
  const cara = await account("privacy_cara");
  const profile = {
    age: 47,
    class: "Junior",
    gender: "Non-binary",
    major: "Computer Science",
    bio: "secret-bio-token",
  };

  function call(
    path: string,
    cookie = "",
    init: RequestInit & { json?: boolean } = {},
  ) {
    const headers = new Headers(init.headers);
    if (cookie) headers.set("cookie", cookie);
    if (init.json) headers.set("accept", "application/json");
    return fetch(base + path, { redirect: "manual", ...init, headers });
  }

  async function save(body: unknown, cookie = alice.cookie, method = "PATCH") {
    return call("/profile", cookie, {
      method,
      json: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function pageData(html: string) {
    const serialized = html.match(
      /<script id="page-data" type="application\/json">(.*?)<\/script>/s,
    )?.[1];
    assert.ok(serialized);
    return JSON.parse(serialized);
  }

  try {
    await t.test("viewing someone else requires a login", async () => {
      const res = await call(`/users/${alice.user.username}`);
      assert.equal(res.status, 302);
      assert.equal(
        res.headers.get("location"),
        `/login?next=${encodeURIComponent(`/users/${alice.user.username}`)}`,
      );
    });

    await t.test("new profiles stay private until the owner opens them", async () => {
      const created = await save(profile, alice.cookie, "POST");
      assert.equal(created.status, 201);
      const saved = await created.json();
      assert.equal(saved.visibility, "private");
      assert.equal(saved.show_age, true);
      assert.equal(saved.show_gender, true);
      assert.equal(saved.show_bio, true);
      assert.equal(saved.age, 47);
      const hidden = await call(`/users/${alice.user.username}`, bob.cookie, {
        json: true,
      });
      assert.equal(hidden.status, 404);
      assert.equal((await save({ visibility: "campus" })).status, 200);
      const seen = await (await call(`/users/${alice.user.username}`, bob.cookie, { json: true })).json();
      assert.equal(seen.age, 47);
      assert.equal(seen.gender, "Non-binary");
      assert.equal(seen.bio, "secret-bio-token");
      assert.equal(seen.major, "Computer Science");
      assert.equal(seen.friendsOnly, false);
      assert.deepEqual(seen.hidden, []);
      assert.equal(seen.email, undefined);
      assert.equal(seen.user_id, undefined);
      assert.ok(!JSON.stringify(seen).includes(alice.user.email));
    });

    await t.test("hidden details stay on the owner's profile only", async () => {
      assert.equal((await save({ show_age: false })).status, 200);
      const owner = await (await call("/profile", alice.cookie, { json: true })).json();
      assert.equal(owner.age, 47);
      assert.equal(owner.show_age, false);
      const seen = await (await call(`/users/${alice.user.username}`, bob.cookie, { json: true })).json();
      assert.equal("age" in seen, false);
      assert.equal(seen.gender, "Non-binary");
      assert.deepEqual(seen.hidden, ["age"]);
      const html = await (await call(`/users/${alice.user.username}`, bob.cookie)).text();
      assert.equal(pageData(html).person.age, undefined);
      assert.match(html, /Not shared:[\s\S]*age/);
    });

    await t.test("friends-only profiles withhold personal details", async () => {
      assert.equal(
        (await save({ visibility: "friends", show_age: true })).status,
        200,
      );
      const stranger = await (
        await call(`/users/${alice.user.username}`, bob.cookie, { json: true })
      ).json();
      assert.equal(stranger.friendsOnly, true);
      assert.equal(stranger.major, "Computer Science");
      assert.equal(stranger.class, "Junior");
      assert.deepEqual(stranger.hidden, ["age", "gender", "bio"]);
      assert.equal("bio" in stranger, false);
      const html = await (await call(`/users/${alice.user.username}`, bob.cookie)).text();
      assert.match(html, /visible to friends/);
      assert.doesNotMatch(html, /secret-bio-token/);
      assert.doesNotMatch(html, /Non-binary/);
    });

    await t.test("accepted friends see details the owner still shares", async () => {
      assert.equal((await save(profile, bob.cookie, "POST")).status, 201);
      const ids = await db
        .selectFrom("profiles")
        .select(["id", "user_id"])
        .where("user_id", "in", [alice.user.id, bob.user.id])
        .execute();
      const aliceId = ids.find((row) => row.user_id === alice.user.id)!.id;
      const bobId = ids.find((row) => row.user_id === bob.user.id)!.id;
      await db
        .insertInto("friends")
        .values({
          profile_a_id: Math.min(aliceId, bobId),
          profile_b_id: Math.max(aliceId, bobId),
        })
        .execute();
      const seen = await (
        await call(`/users/${alice.user.username}`, bob.cookie, { json: true })
      ).json();
      assert.equal(seen.friendsOnly, false);
      assert.equal(seen.age, 47);
      assert.equal(seen.bio, "secret-bio-token");
      assert.equal((await save({ show_gender: false })).status, 200);
      const hiddenGender = await (
        await call(`/users/${alice.user.username}`, bob.cookie, { json: true })
      ).json();
      assert.equal("gender" in hiddenGender, false);
      assert.equal(hiddenGender.age, 47);
      assert.deepEqual(hiddenGender.hidden, ["gender"]);
    });

    await t.test("private profiles and their photos are invisible to others", async () => {
      const aliceProfile = await db
        .selectFrom("profiles")
        .select("id")
        .where("user_id", "=", alice.user.id)
        .executeTakeFirstOrThrow();
      await db
        .insertInto("profile_photos")
        .values({ profile_id: aliceProfile.id, image: Buffer.from("photo-bytes") })
        .execute();
      await db
        .updateTable("profiles")
        .set({ visibility: "campus", profile_picture: PHOTO_URL, show_gender: true })
        .where("user_id", "=", alice.user.id)
        .execute();
      const open = await call(`/users/${alice.user.username}/photo`, bob.cookie);
      assert.equal(open.status, 200);
      assert.match(open.headers.get("content-type")!, /image\/webp/);
      assert.equal(Buffer.from(await open.arrayBuffer()).toString(), "photo-bytes");
      const listed = await (
        await call(`/users/${alice.user.username}`, bob.cookie, { json: true })
      ).json();
      assert.equal(listed.profile_picture, `/users/${alice.user.username}/photo`);

      assert.equal((await save({ visibility: "private" })).status, 200);
      for (const path of [
        `/users/${alice.user.username}`,
        `/users/${alice.user.username}/photo`,
      ]) {
        const hidden = await call(path, bob.cookie, { json: true });
        assert.equal(hidden.status, 404);
        const body = await hidden.json();
        assert.equal(body.error, "Profile not found");
        assert.ok(!JSON.stringify(body).includes("secret-bio-token"));
      }
      const html = await call(`/users/${alice.user.username}`, bob.cookie);
      assert.equal(html.status, 404);
      assert.match(await html.text(), /Profile not found/);
      const ownPhoto = await call(`/users/${alice.user.username}/photo`, alice.cookie);
      assert.equal(ownPhoto.status, 200);
      const ownJson = await (
        await call(`/users/${alice.user.username}`, alice.cookie, { json: true })
      ).json();
      assert.equal(ownJson.age, 47);
      assert.equal(ownJson.bio, "secret-bio-token");
      const ownPage = await call(`/users/${alice.user.username}`, alice.cookie);
      assert.equal(ownPage.status, 302);
      assert.equal(ownPage.headers.get("location"), "/profile");
    });

    await t.test("unsafe photo URLs are dropped and names are matched exactly", async () => {
      await db
        .updateTable("profiles")
        .set({ visibility: "campus", profile_picture: "javascript:alert(1)" })
        .where("user_id", "=", alice.user.id)
        .execute();
      const seen = await (
        await call(`/users/Privacy_Alice`, bob.cookie, { json: true })
      ).json();
      assert.equal(seen.username, "privacy_alice");
      assert.equal(seen.profile_picture, null);
      assert.equal((await call("/users/privacy_alice'", bob.cookie, { json: true })).status, 404);
      assert.equal((await call("/users/nope!", bob.cookie, { json: true })).status, 404);
    });

    await t.test("privacy updates reject bad values and keep unrelated edits", async () => {
      assert.equal((await save({ visibility: "campus" })).status, 200);
      const rejected = await save({ visibility: "everyone" });
      assert.equal(rejected.status, 400);
      assert.equal((await save({ show_age: "yes" })).status, 400);
      assert.equal((await save({ major: "Physics" })).status, 200);
      const saved = await (await call("/profile", alice.cookie, { json: true })).json();
      assert.equal(saved.visibility, "campus");
      assert.equal(saved.major, "Physics");
      assert.equal(saved.age, 47);
      const body = new URLSearchParams();
      body.append("visibility", "friends");
      body.append("show_age", "0");
      body.append("show_gender", "0");
      body.append("show_gender", "1");
      body.append("show_bio", "0");
      body.append("show_bio", "1");
      const form = await call("/profile/edit", alice.cookie, { method: "POST", body });
      assert.equal(form.status, 303);
      const after = await (await call("/profile", alice.cookie, { json: true })).json();
      assert.equal(after.visibility, "friends");
      assert.equal(after.show_age, false);
      assert.equal(after.show_gender, true);
      assert.equal(after.show_bio, true);
      assert.equal(after.major, "Physics");
      const edit = await (await call("/profile?edit=1", alice.cookie)).text();
      assert.match(edit, /Who can open your profile/);
      assert.match(edit, /Only me/);
    });

    await t.test("the database rejects an unknown visibility", async () => {
      await assert.rejects(
        sql`insert into profiles (user_id, age, class, gender, major, visibility) values (${cara.user.id}, 20, 'Junior', 'Other', 'CS', 'secret')`.execute(
          db,
        ),
        { code: "23514" },
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
