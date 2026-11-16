import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { NO_MIGRATIONS } from "kysely/migration";
import sharp from "sharp";
import { createApp } from "../app.js";
import { createMigrator } from "../db/migrator.js";
import { PHOTO_URL } from "../lib/profile-photo.js";
import { createSession, SESSION_COOKIE } from "../lib/sessions.js";
import type { ConnectionsData, DiscoveryData } from "../src/discovery.js";
import { createTestDatabase } from "./helpers/db.js";

test("original connection routes integrate with discovery and friend requests", async (t) => {
  const db = createTestDatabase();
  const migrator = createMigrator(db);
  const migration = await migrator.migrateToLatest();
  if (migration.error) throw migration.error;
  const server = createApp({ db }).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;

  async function account(username: string, withProfile = true) {
    const user = await db.insertInto("users").values({
      username, email: `${username}@charlotte.edu`, password_hash: `private-${username}`,
    }).returningAll().executeTakeFirstOrThrow();
    const { token } = await createSession(db, user.id);
    const profile = withProfile ? await db.insertInto("profiles").values({
      user_id: user.id, age: 21, class: "Junior", gender: "Other",
      major: "Computer Science", bio: `${username} likes board games`, profile_picture: null,
    }).returningAll().executeTakeFirstOrThrow() : null;
    return { user, profile, cookie: `${SESSION_COOKIE}=${token}` };
  }

  // Make account and profile IDs different to detect accidental account-ID joins.
  const newcomer = await account("connections_newcomer", false);
  const alice = await account("connections_alice");
  const bob = await account("connections_bob");
  const carol = await account("connections_carol");
  assert.notEqual(alice.user.id, alice.profile!.id);
  let requestId: number;

  function api(path: string, cookie = alice.cookie, method = "GET", body?: unknown, accept = "application/json", headers: Record<string, string> = {}) {
    return fetch(base + path, {
      method, redirect: "manual",
      headers: { cookie, accept, ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async function json<T>(path: string, cookie = alice.cookie): Promise<T> {
    const response = await api(path, cookie);
    assert.equal(response.status, 200, path);
    return response.json();
  }
  type Incoming = { id: number; sender_id: number; created_at: string; username: string; profile_picture: string | null; bio: string | null };
  type Friend = { id: number; profile_picture: string | null; bio: string | null; username: string };
  const incoming = (cookie = alice.cookie) => json<Incoming[]>("/friends/request", cookie);
  const friends = (cookie = alice.cookie) => json<Friend[]>("/friends/list", cookie);

  try {
    await t.test("original routes require authentication and preserve missing-profile responses", async () => {
      for (const path of ["/friends/request", "/friends/list"]) {
        assert.equal((await api(path, "")).status, 401);
        assert.equal((await api(path, newcomer.cookie)).status, 404);
        assert.deepEqual(await json(path), []);
      }
      assert.equal((await api(`/friends/requests/${bob.profile!.id}`, "", "POST")).status, 401);
      assert.equal((await api(`/friends/requests/${bob.profile!.id}`, newcomer.cookie, "POST")).status, 404);
      // PR45's body-based route keeps its own established 409 response.
      assert.equal((await api("/friends/requests", newcomer.cookie, "POST", { receiver_id: bob.profile!.id })).status, 409);
    });

    await t.test("the path-based route validates IDs and blocks self and cross-site requests", async () => {
      for (const id of ["0", "-1", "1.5", "invalid", "2147483648", "9007199254740992"]) {
        assert.equal((await api(`/friends/requests/${id}`, alice.cookie, "POST")).status, 400, id);
      }
      assert.equal((await api(`/friends/requests/${alice.profile!.id}`, alice.cookie, "POST")).status, 400);
      assert.equal((await api("/friends/requests/2147483647", alice.cookie, "POST")).status, 404);
      assert.equal((await api(`/friends/requests/${bob.profile!.id}`, alice.cookie, "POST", undefined, "application/json", { "sec-fetch-site": "cross-site" })).status, 403);
      assert.deepEqual(await db.selectFrom("friend_request").selectAll().execute(), []);
    });

    await t.test("sending preserves the original JSON contract and takes identity only from the session and URL", async () => {
      const response = await api(`/friends/requests/${bob.profile!.id}`, alice.cookie, "POST", {
        sender_id: carol.profile!.id, receiver_id: carol.profile!.id,
        profileId: carol.profile!.id, user_id: carol.user.id, status: "accepted",
      });
      assert.equal(response.status, 201);
      const body = await response.json();
      assert.deepEqual(Object.keys(body).sort(), ["message", "requestId"]);
      assert.equal(body.message, "Friend request sent!");
      assert.equal(typeof body.requestId, "number");
      requestId = body.requestId;
      const stored = await db.selectFrom("friend_request").selectAll().where("id", "=", requestId).executeTakeFirstOrThrow();
      assert.equal(stored.sender_id, alice.profile!.id);
      assert.equal(stored.receiver_id, bob.profile!.id);
      assert.equal(stored.status, "pending");
    });

    await t.test("the original incoming join returns its exact fields and feeds the live Friends and Discover views", async () => {
      const response = await api("/friends/request", bob.cookie, "GET", undefined, "*/*");
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type")!, /application\/json/);
      assert.match(response.headers.get("cache-control")!, /no-store/);
      const rows: Incoming[] = await response.json();
      assert.equal(rows.length, 1);
      assert.deepEqual(Object.keys(rows[0]).sort(), ["id", "sender_id", "created_at", "username", "profile_picture", "bio"].sort());
      assert.equal(rows[0].id, requestId);
      assert.equal(rows[0].sender_id, alice.profile!.id);
      assert.equal(rows[0].username, alice.user.username);
      assert.equal(rows[0].bio, alice.profile!.bio);
      assert.equal(rows[0].profile_picture, null);
      assert.ok(Number.isFinite(Date.parse(rows[0].created_at)));
      assert.deepEqual(await incoming(), []);
      assert.deepEqual(await incoming(carol.cookie), []);
      assert.deepEqual(await friends(bob.cookie), []);
      const connections = await json<ConnectionsData>("/friends", bob.cookie);
      assert.equal(connections.incoming[0].requestId, rows[0].id);
      assert.equal(connections.incoming[0].username, rows[0].username);
      const discovery = await json<DiscoveryData>("/discover", bob.cookie);
      assert.equal(discovery.people.find((person) => person.profileId === alice.profile!.id)!.connection, "incoming");
      const html = await (await api("/friends", bob.cookie, "GET", undefined, "text/html")).text();
      assert.match(html, new RegExp(`action="/friends/requests/${requestId}/accept"`));
      assert.ok(!JSON.stringify(rows).includes(alice.user.email));
      assert.ok(!html.includes(alice.user.password_hash));
    });

    await t.test("both send routes share duplicate detection in either direction", async () => {
      for (const [sender, target] of [[alice, bob], [bob, alice]]) {
        assert.equal((await api(`/friends/requests/${target.profile!.id}`, sender.cookie, "POST")).status, 409);
        assert.equal((await api("/friends/requests", sender.cookie, "POST", { receiver_id: target.profile!.id })).status, 409);
      }
      assert.equal((await db.selectFrom("friend_request").selectAll().execute()).length, 1);
    });

    await t.test("incoming profile pictures resolve to the sender instead of the viewing student", async () => {
      const senderPhoto = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).webp().toBuffer();
      const viewerPhoto = await sharp({ create: { width: 2, height: 2, channels: 3, background: "blue" } }).webp().toBuffer();
      for (const [profileId, image] of [[alice.profile!.id, senderPhoto], [bob.profile!.id, viewerPhoto]] as const) {
        await db.insertInto("profile_photos").values({ profile_id: profileId, image }).execute();
        await db.updateTable("profiles").set({ profile_picture: PHOTO_URL }).where("id", "=", profileId).execute();
      }
      const row = (await incoming(bob.cookie))[0];
      assert.equal(row.profile_picture, `/discover/${alice.profile!.id}/photo`);
      const photo = await api(row.profile_picture!, bob.cookie);
      assert.equal(photo.status, 200);
      assert.deepEqual(Buffer.from(await photo.arrayBuffer()), senderPhoto);
      assert.equal((await api(row.profile_picture!, "")).status, 401);
    });

    await t.test("acceptance extends the original flow and its friendship mapping works in both directions", async () => {
      assert.equal((await api(`/friends/requests/${requestId}/accept`, alice.cookie, "POST")).status, 403);
      assert.equal((await api(`/friends/requests/${requestId}/accept`, bob.cookie, "POST")).status, 200);
      for (const [viewer, other] of [[alice, bob], [bob, alice]]) {
        assert.deepEqual(await incoming(viewer.cookie), []);
        const rows = await friends(viewer.cookie);
        assert.deepEqual(rows, [{
          id: other.profile!.id, profile_picture: `/discover/${other.profile!.id}/photo`,
          bio: other.profile!.bio, username: other.user.username,
        }]);
        const connections = await json<ConnectionsData>("/friends", viewer.cookie);
        assert.equal(connections.friends[0].profileId, rows[0].id);
        assert.equal(connections.friends[0].profilePicture, rows[0].profile_picture);
        assert.equal((await api(`/friends/requests/${other.profile!.id}`, viewer.cookie, "POST")).status, 409);
        assert.equal((await api("/friends/requests", viewer.cookie, "POST", { receiver_id: other.profile!.id })).status, 409);
      }
      assert.deepEqual(await friends(carol.cookie), []);
      assert.equal((await db.selectFrom("friends").selectAll().execute()).length, 1);
    });

    await t.test("declining a body-based request clears the original incoming list and permits a path-based retry", async () => {
      const sent = await api("/friends/requests", alice.cookie, "POST", { receiver_id: carol.profile!.id });
      assert.equal(sent.status, 201);
      const original = await sent.json();
      assert.equal((await incoming(carol.cookie))[0].id, original.id);
      assert.equal((await api(`/friends/requests/${original.id}/decline`, carol.cookie, "POST")).status, 200);
      assert.deepEqual(await incoming(carol.cookie), []);
      assert.deepEqual(await friends(carol.cookie), []);
      // An ordinary fetch (Accept */*, no JSON body) still gets PR44's JSON response.
      const retried = await api(`/friends/requests/${alice.profile!.id}`, carol.cookie, "POST", undefined, "*/*");
      assert.equal(retried.status, 201);
      assert.match(retried.headers.get("content-type")!, /application\/json/);
      const retry = await retried.json();
      assert.equal(retry.message, "Friend request sent!");
      assert.equal((await incoming())[0].id, retry.requestId);
      assert.equal((await api(`/friends/requests/${retry.requestId}/decline`, alice.cookie, "POST")).status, 200);
    });

    await t.test("Discovery uses the original path route and form redirects keep the search", async () => {
      const html = await (await api("/discover?q=connections_carol", alice.cookie, "GET", undefined, "text/html")).text();
      const action = html.match(/<form\b[^>]*action="(\/friends\/requests\/\d+)"/)?.[1];
      assert.equal(action, `/friends/requests/${carol.profile!.id}`);
      assert.doesNotMatch(html, /name="receiver_id"/);
      const returnTo = "/discover?q=connections_carol";
      const sent = await fetch(base + action, {
        method: "POST", redirect: "manual", headers: { cookie: alice.cookie, accept: "text/html" },
        body: new URLSearchParams({ returnTo }),
      });
      assert.equal(sent.status, 303);
      assert.equal(sent.headers.get("location"), returnTo);
      const discovery = await json<DiscoveryData>(returnTo);
      assert.equal(discovery.people[0].connection, "sent");
      const request = (await incoming(carol.cookie))[0];
      assert.equal((await api(`/friends/requests/${request.id}/decline`, carol.cookie, "POST")).status, 200);
      const external = await fetch(base + action, {
        method: "POST", redirect: "manual", headers: { cookie: alice.cookie, accept: "text/html" },
        body: new URLSearchParams({ returnTo: "https://example.test/" }),
      });
      assert.equal(external.status, 303);
      assert.equal(external.headers.get("location"), "/friends?sent=1");
    });

    await t.test("simultaneous sends through different APIs create one pending request", async () => {
      const first = await account("connections_race_first");
      const second = await account("connections_race_second");
      const results = await Promise.all([
        api(`/friends/requests/${second.profile!.id}`, first.cookie, "POST"),
        api("/friends/requests", second.cookie, "POST", { receiver_id: first.profile!.id }),
      ]);
      assert.deepEqual(results.map((response) => response.status).sort(), [201, 409]);
      const rows = await db.selectFrom("friend_request").selectAll()
        .where("sender_id", "in", [first.profile!.id, second.profile!.id]).execute();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, "pending");
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    const rollback = await migrator.migrateTo(NO_MIGRATIONS);
    await db.destroy();
    if (rollback.error) throw rollback.error;
  }
});
