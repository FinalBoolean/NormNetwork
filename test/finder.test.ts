import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { NO_MIGRATIONS } from "kysely/migration";
import { createApp } from "../app.js";
import { createMigrator } from "../db/migrator.js";
import { orderedPair } from "../lib/friends.js";
import { createSession, SESSION_COOKIE } from "../lib/sessions.js";
import type { FinderData } from "../src/finder.js";
import { createTestDatabase } from "./helpers/db.js";

test("friend finder shows real students", async (t) => {
  const db = createTestDatabase();
  const migrator = createMigrator(db);
  const migration = await migrator.migrateToLatest();
  if (migration.error) throw migration.error;
  const server = createApp({ db }).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;

  async function account(
    username: string,
    options: {
      profile?: boolean;
      friends?: boolean;
      interests?: string;
      privacy?: { visibility?: "campus" | "friends" | "private"; show_age?: boolean };
    } = {},
  ) {
    const user = await db.insertInto("users").values({
      username,
      email: `${username}@charlotte.edu`,
      password_hash: "unused-in-this-test",
    }).returningAll().executeTakeFirstOrThrow();
    const { token } = await createSession(db, user.id);
    const profile = options.profile === false ? null : await db.insertInto("profiles").values({
      user_id: user.id,
      age: 20,
      class: "Junior",
      gender: "Other",
      major: "Computer Science",
      bio: `${username} bio`,
      // Profiles are private by default (migration 017).
      visibility: "campus",
      ...options.privacy,
    }).returningAll().executeTakeFirstOrThrow();
    if (profile && options.interests !== undefined) {
      await db.insertInto("friend_finder").values({
        user_id: user.id, interest: options.interests, preferred_gender: "Any",
      }).execute();
    }
    if (profile && options.friends) {
      await db.insertInto("companion_types").values({ user_id: user.id, type: "friends" }).execute();
    }
    return { user, profile, cookie: `${SESSION_COOKIE}=${token}` };
  }

  const viewer = await account("ff_viewer", { friends: true, interests: "Hiking, Coffee, Live music" });
  const twoShared = await account("ff_two", { friends: true, interests: "hiking, Coffee" });
  const oneShared = await account("ff_one", { friends: true, interests: "Coffee, Chess" });
  const noneShared = await account("ff_none", { friends: true, interests: "Chess" });
  const hiddenAge = await account("ff_hidden_age", { friends: true, interests: "Chess", privacy: { show_age: false } });
  const friendsOnly = await account("ff_friends_only", { friends: true, interests: "Chess", privacy: { visibility: "friends" } });
  const privateOne = await account("ff_private", { friends: true, interests: "Hiking", privacy: { visibility: "private" } });
  const alreadyFriend = await account("ff_friend", { friends: true, interests: "Hiking" });
  const requested = await account("ff_requested", { friends: true, interests: "Hiking" });
  const notOptedIn = await account("ff_not_opted_in", { interests: "Hiking" });
  const noProfile = await account("ff_no_profile", { profile: false });

  const [a, b] = orderedPair(viewer.profile!.id, alreadyFriend.profile!.id);
  await db.insertInto("friends").values({ profile_a_id: a, profile_b_id: b }).execute();
  await db.insertInto("friend_request")
    .values({ sender_id: requested.profile!.id, receiver_id: viewer.profile!.id }).execute();

  async function finder(path: string, cookie = viewer.cookie) {
    const res = await fetch(base + path, { headers: { cookie, accept: "text/html" } });
    assert.equal(res.status, 200, path);
    const html = await res.text();
    const payload = html.match(/<script id="page-data" type="application\/json">(.*?)<\/script>/s)?.[1];
    assert.ok(payload);
    return { res, html, data: JSON.parse(payload) as { finder: FinderData; notice?: string } };
  }
  const usernames = (data: FinderData) => data.candidates.map((c) => c.username);

  try {
    await t.test("logged-out visitors see the page but no students", async () => {
      const { html, data } = await finder("/finder/friends", "");
      assert.equal(data.finder.signedIn, false);
      assert.deepEqual(data.finder.candidates, []);
      assert.doesNotMatch(html, /ff_two/);
      assert.match(html, /Log in to meet/);
    });

    await t.test("lists opted-in students, most shared interests first", async () => {
      const { res, data } = await finder("/finder/friends");
      assert.match(res.headers.get("cache-control")!, /no-store/);
      assert.equal(data.finder.hasProfile, true);
      const names = usernames(data.finder);
      assert.deepEqual(names.slice(0, 2), [twoShared.user.username, oneShared.user.username]);
      assert.deepEqual(
        [...names].sort(),
        [twoShared, oneShared, noneShared, hiddenAge, friendsOnly].map((x) => x.user.username).sort(),
      );
      const top = data.finder.candidates[0];
      assert.deepEqual(top.shared, ["hiking", "Coffee"]);
      assert.equal(top.profileId, twoShared.profile!.id);
    });

    await t.test("leaves out self, private profiles, friends, pending requests, and students who didn't opt in", async () => {
      const names = usernames((await finder("/finder/friends")).data.finder);
      for (const left of [viewer, privateOne, alreadyFriend, requested, notOptedIn])
        assert.ok(!names.includes(left.user.username), left.user.username);
    });

    await t.test("hidden details follow each student's privacy settings", async () => {
      const { html, data } = await finder("/finder/friends");
      const byName = new Map(data.finder.candidates.map((c) => [c.username, c]));
      const age = byName.get(hiddenAge.user.username)!;
      assert.equal(age.age, undefined);
      assert.deepEqual(age.hidden, ["age"]);
      assert.equal(age.bio, `${hiddenAge.user.username} bio`);
      const limited = byName.get(friendsOnly.user.username)!;
      assert.equal(limited.age, undefined);
      assert.equal(limited.bio, undefined);
      assert.doesNotMatch(html, /ff_friends_only bio/);
      for (const other of [twoShared, hiddenAge, friendsOnly])
        assert.ok(!html.includes(other.user.email), other.user.email);
    });

    await t.test("Connect sends a request and returns to the finder", async () => {
      const res = await fetch(`${base}/friends/requests`, {
        method: "POST",
        redirect: "manual",
        headers: { cookie: viewer.cookie, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          receiver_id: String(twoShared.profile!.id),
          returnTo: "/finder/friends?sent=1",
        }),
      });
      assert.equal(res.status, 303);
      assert.equal(res.headers.get("location"), "/finder/friends?sent=1");
      const { data } = await finder("/finder/friends?sent=1");
      assert.equal(data.notice, "Friend request sent.");
      assert.ok(!usernames(data.finder).includes(twoShared.user.username));
    });

    await t.test("Connect can't redirect off-site", async () => {
      const res = await fetch(`${base}/friends/requests`, {
        method: "POST",
        redirect: "manual",
        headers: { cookie: viewer.cookie, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          receiver_id: String(oneShared.profile!.id),
          returnTo: "//evil.example/finder/friends",
        }),
      });
      assert.equal(res.status, 303);
      assert.equal(res.headers.get("location"), "/friends?sent=1");
    });

    await t.test("students without a profile are asked to create one", async () => {
      const { html, data } = await finder("/finder/friends", noProfile.cookie);
      assert.equal(data.finder.hasProfile, false);
      assert.ok(data.finder.candidates.length > 0);
      assert.match(html, /Create your profile/);
      assert.doesNotMatch(html, /action="\/friends\/requests"/);
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
