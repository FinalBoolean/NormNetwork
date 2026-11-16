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

test("user discovery and connection flow", async (t) => {
  const db = createTestDatabase();
  const migrator = createMigrator(db);
  const migration = await migrator.migrateToLatest();
  if (migration.error) throw migration.error;
  const server = createApp({ db }).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;

  async function account(username: string, profile?: { major: string; bio: string }) {
    const user = await db.insertInto("users").values({
      username,
      email: `${username}@charlotte.edu`,
      password_hash: `private-hash-${username}`,
    }).returningAll().executeTakeFirstOrThrow();
    const { token } = await createSession(db, user.id);
    const saved = profile ? await db.insertInto("profiles").values({
      user_id: user.id,
      age: 21,
      class: "Junior",
      gender: "Other",
      major: profile.major,
      bio: profile.bio,
      profile_picture: null,
    }).returningAll().executeTakeFirstOrThrow() : null;
    return { user, profile: saved, cookie: `${SESSION_COOKIE}=${token}` };
  }

  // Different user/profile IDs catch accidental use of account IDs in friendships.
  const newcomer = await account("discover_newcomer");
  const alice = await account("discover_alice", { major: "Computer Science", bio: "Coffee and coding" });
  const bob = await account("discover_bob", { major: "Physics", bio: "Night owl telescope club" });
  const carol = await account("discover_carol", { major: "Biology", bio: "I enjoy the 100%_club" });
  assert.notEqual(alice.user.id, alice.profile!.id);
  let requestId: number;

  function api(path: string, cookie = alice.cookie, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
    return fetch(base + path, {
      method,
      redirect: "manual",
      headers: {
        accept: "application/json", cookie,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  function page(path: string, cookie = alice.cookie, form?: Record<string, string>) {
    return fetch(base + path, {
      method: form ? "POST" : "GET",
      redirect: "manual",
      headers: { cookie, accept: "text/html" },
      body: form ? new URLSearchParams(form) : undefined,
    });
  }
  async function discovery(cookie = alice.cookie, query = ""): Promise<DiscoveryData> {
    const response = await api(`/discover${query}`, cookie);
    assert.equal(response.status, 200);
    return response.json();
  }
  async function connections(cookie = alice.cookie): Promise<ConnectionsData> {
    const response = await api("/friends", cookie);
    assert.equal(response.status, 200);
    return response.json();
  }
  function pageData(html: string) {
    const payload = html.match(/<script id="page-data" type="application\/json">(.*?)<\/script>/s)?.[1];
    assert.ok(payload);
    assert.ok(!payload.includes("<"));
    return JSON.parse(payload);
  }

  try {
    await t.test("all discovery, photo, and connection endpoints require authentication", async () => {
      for (const path of ["/discover", "/friends", `/discover/${bob.profile!.id}/photo`]) {
        assert.equal((await api(path, "")).status, 401, path);
      }
      for (const path of ["/friends/requests", "/friends/requests/1/accept", "/friends/requests/1/decline"]) {
        assert.equal((await api(path, "", "POST", { receiver_id: bob.profile!.id })).status, 401, path);
      }
      const response = await page("/discover?q=physics", "");
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), "/login?next=%2Fdiscover%3Fq%3Dphysics");
    });

    await t.test("lists real profiles, excludes self and incomplete accounts, and protects private fields", async () => {
      const response = await api("/discover");
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control")!, /no-store/);
      assert.match(response.headers.get("vary")!, /Accept/);
      const data: DiscoveryData = await response.json();
      assert.equal(data.hasProfile, true);
      assert.equal(data.page, 1);
      assert.equal(data.hasNext, false);
      assert.deepEqual(data.people.map((person) => person.username).sort(), [bob.user.username, carol.user.username]);
      const person = data.people.find((person) => person.profileId === bob.profile!.id)!;
      assert.equal(person.connection, "none");
      assert.equal(person.requestId, null);
      assert.equal(person.major, "Physics");
      assert.equal(person.bio, bob.profile!.bio);
      assert.equal(person.profilePicture, null);
      for (const profile of data.people) {
        assert.deepEqual(Object.keys(profile).sort(), ["profileId", "username", "age", "class", "major", "bio", "profilePicture", "connection", "requestId"].sort());
      }
      const serialized = JSON.stringify(data);
      assert.ok(!serialized.includes(bob.user.email));
      assert.ok(!serialized.includes(bob.user.password_hash));
      assert.ok(!serialized.includes("user_id"));
    });

    await t.test("search matches username, major, and bio without case sensitivity", async () => {
      for (const q of ["DISCOVER_BOB", "PHYSICS", "TELESCOPE"]) {
        const data = await discovery(alice.cookie, `?q=${q}`);
        assert.deepEqual(data.people.map((person) => person.profileId), [bob.profile!.id], q);
      }
      const trimmed = await discovery(alice.cookie, "?q=%20%20Physics%20%20");
      assert.equal(trimmed.query, "Physics");
      assert.equal(trimmed.people.length, 1);
      assert.equal((await discovery(alice.cookie, "?q=nonexistentstudent")).people.length, 0);
      assert.equal((await discovery(alice.cookie, "?q=discover_alice")).people.length, 0);
      for (const q of ["%", "%_club"]) {
        assert.deepEqual((await discovery(alice.cookie, `?q=${encodeURIComponent(q)}`)).people.map((person) => person.profileId), [carol.profile!.id]);
      }
      assert.equal((await discovery(alice.cookie, "?q=%5C")).people.length, 0);
      assert.equal((await discovery(alice.cookie, "?q=%27%20OR%20true%20--")).people.length, 0);
    });

    await t.test("students without profiles can browse but cannot send requests", async () => {
      const data = await discovery(newcomer.cookie);
      assert.equal(data.hasProfile, false);
      assert.equal(data.people.length, 3);
      assert.equal((await api("/friends/requests", newcomer.cookie, "POST", { receiver_id: bob.profile!.id })).status, 409);
      const list = await connections(newcomer.cookie);
      assert.equal(list.hasProfile, false);
      assert.deepEqual([list.incoming, list.outgoing, list.friends], [[], [], []]);
      const html = await (await page("/discover", newcomer.cookie)).text();
      assert.match(html, /href="\/profile"/);
      assert.doesNotMatch(html, /action="\/friends\/requests(?:\/\d+)?"/);
    });

    await t.test("rejects malformed search and page parameters", async () => {
      for (const query of ["?q=a&q=b", `?q=${"x".repeat(201)}`, "?page=0", "?page=-1", "?page=1.5", "?page=abc", "?page=9007199254740992", "?page=1&page=2"]) {
        assert.equal((await api(`/discover${query}`)).status, 400, query);
      }
    });

    await t.test("rejects invalid targets and self connections before creating requests", async () => {
      for (const body of [{}, { receiver_id: null }, { receiver_id: [] }, { receiver_id: {} }, { receiver_id: "1.5" }, { receiver_id: 0 }, { receiver_id: -1 }, { receiver_id: "invalid" }]) {
        assert.equal((await api("/friends/requests", alice.cookie, "POST", body)).status, 400, JSON.stringify(body));
      }
      assert.equal((await api("/friends/requests", alice.cookie, "POST", { receiver_id: alice.profile!.id })).status, 400);
      assert.equal((await api("/friends/requests", alice.cookie, "POST", { receiver_id: 2147483647 })).status, 404);
      assert.equal((await db.selectFrom("friend_request").selectAll().execute()).length, 0);
    });

    await t.test("cross-site requests cannot send, accept, or decline connections", async () => {
      for (const path of ["/friends/requests", "/friends/requests/1/accept", "/friends/requests/1/decline"]) {
        const response = await api(path, alice.cookie, "POST", { receiver_id: bob.profile!.id }, { "sec-fetch-site": "cross-site" });
        assert.equal(response.status, 403, path);
      }
      assert.equal((await db.selectFrom("friend_request").selectAll().execute()).length, 0);
    });

    await t.test("sends a request using session identity and updates both students' views", async () => {
      const response = await api("/friends/requests", alice.cookie, "POST", {
        receiver_id: bob.profile!.id,
        sender_id: carol.profile!.id,
        profileId: carol.profile!.id,
        user_id: carol.user.id,
        status: "accepted",
      });
      assert.equal(response.status, 201);
      const result = await response.json();
      assert.equal(result.status, "pending");
      assert.equal(typeof result.id, "number");
      requestId = result.id;
      const stored = await db.selectFrom("friend_request").selectAll().where("id", "=", requestId).executeTakeFirstOrThrow();
      assert.equal(stored.sender_id, alice.profile!.id);
      assert.equal(stored.receiver_id, bob.profile!.id);
      assert.equal(stored.status, "pending");
      assert.equal((await db.selectFrom("friends").selectAll().execute()).length, 0);
      const sent = (await discovery()).people.find((person) => person.profileId === bob.profile!.id)!;
      const incoming = (await discovery(bob.cookie)).people.find((person) => person.profileId === alice.profile!.id)!;
      assert.equal(sent.connection, "sent");
      assert.equal(incoming.connection, "incoming");
      assert.equal(sent.requestId, requestId);
      assert.equal(incoming.requestId, requestId);
      assert.deepEqual((await connections()).outgoing.map((person) => person.profileId), [bob.profile!.id]);
      assert.deepEqual((await connections(bob.cookie)).incoming.map((person) => person.profileId), [alice.profile!.id]);
    });

    await t.test("duplicate and reverse requests cannot create extra pending rows", async () => {
      const duplicate = await api("/friends/requests", alice.cookie, "POST", { receiver_id: bob.profile!.id });
      assert.equal(duplicate.status, 409);
      assert.equal((await api("/friends/requests", bob.cookie, "POST", { receiver_id: alice.profile!.id })).status, 409);
      assert.equal((await db.selectFrom("friend_request").selectAll().execute()).length, 1);
    });

    await t.test("HTML includes live profiles and working connection forms with safe serialized data", async () => {
      const html = await (await page("/discover", bob.cookie)).text();
      const payload = pageData(html);
      assert.equal(payload.discovery.people.find((person: { profileId: number }) => person.profileId === alice.profile!.id).connection, "incoming");
      assert.match(html, new RegExp(`action="/friends/requests/${requestId}/accept"`));
      assert.match(html, new RegExp(`action="/friends/requests/${requestId}/decline"`));
      assert.match(html, /action="\/discover"/);
      assert.match(html, new RegExp(`action="/friends/requests/${carol.profile!.id}"`));
      assert.doesNotMatch(html, /name="receiver_id"/);
      assert.ok(!html.includes(alice.user.email));
      assert.ok(!html.includes(alice.user.password_hash));
      const friendsHtml = await (await page("/friends", bob.cookie)).text();
      assert.equal(pageData(friendsHtml).connections.incoming[0].username, alice.user.username);
      assert.match(friendsHtml, new RegExp(`action="/friends/requests/${requestId}/accept"`));
      assert.doesNotMatch(friendsHtml, /Maya Patel|Jordan Ellis|Aisha Rahman|Leo Chen/);
    });

    await t.test("only the receiver may accept or decline a pending request", async () => {
      for (const cookie of [alice.cookie, carol.cookie]) {
        for (const action of ["accept", "decline"]) {
          const response = await api(`/friends/requests/${requestId}/${action}`, cookie, "POST", { receiver_id: bob.profile!.id });
          assert.equal(response.status, 403);
        }
      }
      const pending = await db.selectFrom("friend_request").select("status").where("id", "=", requestId).executeTakeFirstOrThrow();
      assert.equal(pending.status, "pending");
      assert.equal((await db.selectFrom("friends").selectAll().execute()).length, 0);
    });

    await t.test("accepting creates one canonical friendship visible to both students", async () => {
      const accepted = await api(`/friends/requests/${requestId}/accept`, bob.cookie, "POST", {});
      assert.equal(accepted.status, 200);
      assert.equal((await accepted.json()).status, "accepted");
      const friendships = await db.selectFrom("friends").selectAll().execute();
      assert.equal(friendships.length, 1);
      assert.equal(friendships[0].profile_a_id, Math.min(alice.profile!.id, bob.profile!.id));
      assert.equal(friendships[0].profile_b_id, Math.max(alice.profile!.id, bob.profile!.id));
      for (const [viewer, other] of [[alice, bob], [bob, alice]]) {
        const list = await connections(viewer.cookie);
        assert.deepEqual(list.incoming, []);
        assert.deepEqual(list.outgoing, []);
        assert.deepEqual(list.friends.map((person) => person.profileId), [other.profile!.id]);
        assert.equal(list.friends[0].connection, "friends");
        assert.equal((await discovery(viewer.cookie)).people.find((person) => person.profileId === other.profile!.id)!.connection, "friends");
      }
      const html = await (await page("/friends")).text();
      assert.equal(pageData(html).connections.friends[0].username, bob.user.username);
    });

    await t.test("accepted requests cannot be replayed, declined, or resent", async () => {
      for (const action of ["accept", "decline"]) {
        assert.equal((await api(`/friends/requests/${requestId}/${action}`, bob.cookie, "POST", {})).status, 409);
      }
      for (const [sender, target] of [[alice, bob], [bob, alice]]) {
        assert.equal((await api("/friends/requests", sender.cookie, "POST", { receiver_id: target.profile!.id })).status, 409);
      }
      assert.equal((await db.selectFrom("friends").selectAll().execute()).length, 1);
    });

    await t.test("declining clears pending views without creating a friendship and allows a later request", async () => {
      const sent = await api("/friends/requests", alice.cookie, "POST", { receiver_id: carol.profile!.id });
      assert.equal(sent.status, 201);
      const declinedId = (await sent.json()).id;
      const declined = await api(`/friends/requests/${declinedId}/decline`, carol.cookie, "POST", {});
      assert.equal(declined.status, 200);
      assert.equal((await declined.json()).status, "declined");
      assert.deepEqual((await connections(carol.cookie)).incoming, []);
      assert.deepEqual((await connections()).outgoing, []);
      assert.equal((await discovery()).people.find((person) => person.profileId === carol.profile!.id)!.connection, "none");
      assert.equal((await api(`/friends/requests/${declinedId}/accept`, carol.cookie, "POST", {})).status, 409);
      assert.equal((await db.selectFrom("friends").selectAll().execute()).length, 1);
      const retry = await api("/friends/requests", carol.cookie, "POST", { receiver_id: alice.profile!.id });
      assert.equal(retry.status, 201);
      const retryId = (await retry.json()).id;
      const accepted = await page(`/friends/requests/${retryId}/accept`, alice.cookie, {});
      assert.equal(accepted.status, 303);
      assert.equal(accepted.headers.get("location"), "/friends");
      assert.equal((await connections()).friends.length, 2);
    });

    await t.test("invalid or unknown request IDs cannot change existing connections", async () => {
      for (const action of ["accept", "decline"]) {
        for (const id of ["0", "-1", "1.5", "invalid"]) {
          assert.equal((await api(`/friends/requests/${id}/${action}`, alice.cookie, "POST", {})).status, 400);
        }
        assert.equal((await api(`/friends/requests/2147483647/${action}`, alice.cookie, "POST", {})).status, 404);
      }
      assert.equal((await db.selectFrom("friends").selectAll().execute()).length, 2);
    });

    await t.test("profile photos resolve to the discovered student and remain authenticated", async () => {
      const alicePhoto = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).webp().toBuffer();
      const bobPhoto = await sharp({ create: { width: 2, height: 2, channels: 3, background: "blue" } }).webp().toBuffer();
      for (const [profileId, image] of [[alice.profile!.id, alicePhoto], [bob.profile!.id, bobPhoto]] as const) {
        await db.insertInto("profile_photos").values({ profile_id: profileId, image }).execute();
        await db.updateTable("profiles").set({ profile_picture: PHOTO_URL }).where("id", "=", profileId).execute();
      }
      const person = (await discovery()).people.find((person) => person.profileId === bob.profile!.id)!;
      assert.equal(person.profilePicture, `/discover/${bob.profile!.id}/photo`);
      const response = await api(person.profilePicture!);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type")!, /image\/webp/);
      assert.match(response.headers.get("cache-control")!, /private.*no-store/);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bobPhoto);
      assert.equal((await api(`/discover/${carol.profile!.id}/photo`)).status, 404);
      assert.equal((await api("/discover/invalid/photo")).status, 400);
      assert.equal((await api("/discover/2147483647/photo")).status, 404);
      await db.updateTable("profiles").set({ profile_picture: "https://example.test/carol.webp" }).where("id", "=", carol.profile!.id).execute();
      assert.equal((await discovery()).people.find((person) => person.profileId === carol.profile!.id)!.profilePicture, "https://example.test/carol.webp");
    });

    await t.test("profile content is safely escaped in cards and hydration payloads", async () => {
      const bio = '</script><script>alert("discovery")</script>';
      await db.updateTable("profiles").set({ bio }).where("id", "=", carol.profile!.id).execute();
      const html = await (await page("/discover?q=discover_carol")).text();
      assert.ok(!html.includes(bio));
      assert.match(html, /&lt;\/script&gt;/);
      assert.equal(pageData(html).discovery.people[0].bio, bio);
      const empty = await (await page("/discover?q=nonexistentstudent")).text();
      assert.deepEqual(pageData(empty).discovery.people, []);
      assert.doesNotMatch(empty, /action="\/friends\/requests(?:\/\d+)?"/);
    });

    await t.test("HTML request forms preserve safe return locations and reject external redirects", async () => {
      const target = await account("discover_forms", { major: "Art", bio: "Sketching" });
      for (const returnTo of ["https://example.test/", "//example.test/", "/discover/../login", "/profile"]) {
        const response = await page("/friends/requests", alice.cookie, { receiver_id: String(target.profile!.id), returnTo });
        assert.equal(response.status, 303);
        assert.equal(response.headers.get("location"), "/friends?sent=1");
        const pending = (await connections(target.cookie)).incoming[0];
        assert.equal((await api(`/friends/requests/${pending.requestId}/decline`, target.cookie, "POST", {})).status, 200);
      }
      const safe = "/discover?q=discover_forms&page=1";
      const sent = await page("/friends/requests", alice.cookie, { receiver_id: String(target.profile!.id), returnTo: safe });
      assert.equal(sent.status, 303);
      assert.equal(sent.headers.get("location"), safe);
      const incoming = (await connections(target.cookie)).incoming[0];
      const declined = await page(`/friends/requests/${incoming.requestId}/decline`, target.cookie, { returnTo: "/discover?q=discover_alice" });
      assert.equal(declined.status, 303);
      assert.equal(declined.headers.get("location"), "/discover?q=discover_alice");
      assert.deepEqual((await connections(target.cookie)).incoming, []);
    });

    await t.test("pagination is stable, bounded, and retains search independently of other profiles", async () => {
      for (let i = 0; i < 13; i++) {
        await account(`paging_student_${String(i).padStart(2, "0")}`, { major: "Mathematics", bio: "Pagination cohort" });
      }
      const first = await discovery(alice.cookie, "?q=paging_student&page=1");
      const second = await discovery(alice.cookie, "?q=paging_student&page=2");
      assert.equal(first.people.length, 12);
      assert.equal(first.hasNext, true);
      assert.equal(second.people.length, 1);
      assert.equal(second.hasNext, false);
      assert.equal(second.page, 2);
      const combined = [...first.people, ...second.people].map((person) => person.profileId);
      assert.equal(new Set(combined).size, 13);
      assert.deepEqual((await discovery(alice.cookie, "?q=paging_student&page=1")).people, first.people);
      assert.deepEqual((await discovery(alice.cookie, "?q=paging_student&page=3")).people, []);
      const firstHtml = await (await page("/discover?q=paging_student&page=1")).text();
      assert.match(firstHtml, /href="\/discover\?[^\"]*page=2/);
      assert.match(firstHtml, /q=paging_student/);
      const secondHtml = await (await page("/discover?q=paging_student&page=2")).text();
      const previousHref = secondHtml.match(/<a\b[^>]*href="([^"]+)"[^>]*>Previous<\/a>/)?.[1];
      assert.ok(previousHref);
      const previousResponse = await api(previousHref.replaceAll("&amp;", "&"));
      assert.equal(previousResponse.status, 200);
      const previous: DiscoveryData = await previousResponse.json();
      assert.equal(previous.query, "paging_student");
      assert.equal(previous.page, 1);
      assert.deepEqual(previous.people.map((person) => person.profileId), first.people.map((person) => person.profileId));
    });

    await t.test("profile deletion removes that student and their connections", async () => {
      const deleted = await api("/profile", carol.cookie, "DELETE");
      assert.ok(deleted.status === 200 || deleted.status === 204);
      assert.equal((await discovery(alice.cookie, "?q=discover_carol")).people.length, 0);
      assert.deepEqual((await connections()).friends.map((person) => person.profileId), [bob.profile!.id]);
      assert.equal((await db.selectFrom("friend_request").selectAll().where((eb) => eb.or([
        eb("sender_id", "=", carol.profile!.id), eb("receiver_id", "=", carol.profile!.id),
      ])).execute()).length, 0);
    });

    // Real PostgreSQL has independent connections; PGlite's shared client cannot
    // model concurrent transactions and would produce misleading race results.
    await t.test("simultaneous duplicate requests and accepts remain atomic", { skip: !process.env.TEST_DATABASE_URL }, async () => {
      const sender = await account("discovery_race_sender", { major: "Art", bio: "Race test" });
      const receiver = await account("discovery_race_receiver", { major: "Art", bio: "Race test" });
      const sent = await Promise.all([
        api("/friends/requests", sender.cookie, "POST", { receiver_id: receiver.profile!.id }),
        api("/friends/requests", sender.cookie, "POST", { receiver_id: receiver.profile!.id }),
      ]);
      assert.deepEqual(sent.map((response) => response.status).sort(), [201, 409]);
      const created = await sent.find((response) => response.status === 201)!.json();
      assert.equal((await connections(receiver.cookie)).incoming.length, 1);
      const accepted = await Promise.all([
        api(`/friends/requests/${created.id}/accept`, receiver.cookie, "POST", {}),
        api(`/friends/requests/${created.id}/accept`, receiver.cookie, "POST", {}),
      ]);
      assert.deepEqual(accepted.map((response) => response.status).sort(), [200, 409]);
      assert.equal((await connections(sender.cookie)).friends.length, 1);
    });

    await t.test("simultaneous opposite requests and accept/decline cannot contradict each other", { skip: !process.env.TEST_DATABASE_URL }, async () => {
      const first = await account("discovery_race_first", { major: "Art", bio: "Opposite request test" });
      const second = await account("discovery_race_second", { major: "Art", bio: "Opposite request test" });
      const sent = await Promise.all([
        api("/friends/requests", first.cookie, "POST", { receiver_id: second.profile!.id }),
        api("/friends/requests", second.cookie, "POST", { receiver_id: first.profile!.id }),
      ]);
      assert.deepEqual(sent.map((response) => response.status).sort(), [201, 409]);
      const receiver = sent[0].status === 201 ? second : first;
      const pending = (await connections(receiver.cookie)).incoming;
      assert.equal(pending.length, 1);
      const responses = await Promise.all([
        api(`/friends/requests/${pending[0].requestId}/accept`, receiver.cookie, "POST", {}),
        api(`/friends/requests/${pending[0].requestId}/decline`, receiver.cookie, "POST", {}),
      ]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
      const final = await db.selectFrom("friend_request").select("status").where("id", "=", pending[0].requestId!).executeTakeFirstOrThrow();
      assert.equal(final.status, responses[0].status === 200 ? "accepted" : "declined");
      const firstConnections = await connections(first.cookie);
      const secondConnections = await connections(second.cookie);
      assert.deepEqual(firstConnections.incoming, []);
      assert.deepEqual(firstConnections.outgoing, []);
      assert.deepEqual(secondConnections.incoming, []);
      assert.deepEqual(secondConnections.outgoing, []);
      assert.equal(firstConnections.friends.length, final.status === "accepted" ? 1 : 0);
      assert.equal(secondConnections.friends.length, firstConnections.friends.length);
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    const rollback = await migrator.migrateTo(NO_MIGRATIONS);
    await db.destroy();
    if (rollback.error) throw rollback.error;
  }
});
