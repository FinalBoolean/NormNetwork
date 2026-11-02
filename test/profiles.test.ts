import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { NO_MIGRATIONS } from "kysely/migration";
import { createApp } from "../app.js";
import { createMigrator } from "../db/migrator.js";
import { createSession, SESSION_COOKIE } from "../lib/sessions.js";
import { createTestDatabase } from "./helpers/db.js";

// No application DATABASE_URL is needed: routes use the injected test database.
test("profile CRUD and React forms", async (t) => {
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
  const alice = await account("profile_alice");
  const bob = await account("profile_bob");
  const valid = {
    age: 20,
    class: "Junior",
    gender: "Other",
    major: "Computer Science",
    bio: "Hello campus",
    profile_picture: "https://example.test/photo.png",
  };
  function api(method = "GET", body?: unknown, cookie = alice.cookie) {
    return fetch(`${base}/profile`, {
      method,
      redirect: "manual",
      headers: {
        accept: "application/json",
        cookie,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  function page(path = "/profile", init: RequestInit = {}) {
    return fetch(base + path, {
      redirect: "manual",
      ...init,
      headers: { cookie: alice.cookie, ...init.headers },
    });
  }
  try {
    await t.test("requires a session for all CRUD endpoints", async () => {
      for (const method of ["GET", "POST", "PATCH", "DELETE"])
        assert.equal(
          (await api(method, method === "GET" ? undefined : valid, "")).status,
          401,
        );
    });
    await t.test(
      "missing profile renders setup in HTML and 404 for JSON",
      async () => {
        assert.equal((await api()).status, 404);
        const res = await page();
        assert.equal(res.status, 200);
        const html = await res.text();
        assert.match(html, /Set up your profile/);
        assert.doesNotMatch(html, /Maya Patel/);
      },
    );
    await t.test(
      "rejects malformed, out-of-range, oversized, and unsafe values",
      async () => {
        for (const invalid of [
          {},
          [],
          { ...valid, age: "20.5" },
          { ...valid, age: null },
          { ...valid, age: -1 },
          { ...valid, age: 121 },
          { ...valid, major: " " },
          { ...valid, class: "x".repeat(11) },
          { ...valid, bio: {} },
          { ...valid, gender: ["Other"] },
          { ...valid, profile_picture: "javascript:alert(1)" },
          { ...valid, bio: "x".repeat(2001) },
        ]) {
          assert.equal((await api("POST", invalid)).status, 400);
        }
        assert.equal(
          (await db.selectFrom("profiles").selectAll().execute()).length,
          0,
        );
      },
    );
    await t.test(
      "creates only the session user's profile and handles duplicate races",
      async () => {
        const results = await Promise.all([
          api("POST", { ...valid, user_id: bob.user.id }),
          api("POST", valid),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
        const profile = await (await api()).json();
        assert.equal(profile.user_id, alice.user.id);
        assert.equal(profile.major, valid.major);
        assert.equal((await api("GET", undefined, bob.cookie)).status, 404);
        assert.equal(
          (await db.selectFrom("profiles").selectAll().execute()).length,
          1,
        );
      },
    );
    await t.test(
      "renders saved data and serializes profile props safely",
      async () => {
        const hostile = '</script><script>alert("x")</script>';
        assert.equal((await api("PATCH", { bio: hostile })).status, 200);
        const html = await (await page()).text();
        assert.match(html, /profile_alice/);
        assert.match(html, /Computer Science/);
        assert.doesNotMatch(html, /<script>alert/);
        const serialized = html.match(
          /<script id="page-data" type="application\/json">(.*?)<\/script>/s,
        )?.[1];
        assert.ok(serialized);
        assert.equal(JSON.parse(serialized).profile.bio, hostile);
        assert.ok(!serialized.includes("password_hash"));
      },
    );
    await t.test(
      "partial updates preserve other fields and cannot change ownership",
      async () => {
        const res = await api("PATCH", {
          major: "Physics",
          user_id: bob.user.id,
          id: 9999,
        });
        assert.equal(res.status, 200);
        const profile = await res.json();
        assert.equal(profile.user_id, alice.user.id);
        assert.equal(profile.age, 20);
        assert.equal(profile.major, "Physics");
        assert.equal((await api("PATCH", {})).status, 400);
        assert.equal((await api("PATCH", { major: null })).status, 400);
        assert.equal((await api("PATCH", { bio: "" })).status, 200);
        assert.equal((await (await api()).json()).bio, null);
        assert.equal(
          (await api("PATCH", { major: "Stolen" }, bob.cookie)).status,
          404,
        );
      },
    );
    await t.test(
      "HTML edits validate, preserve entered values, and redirect on save",
      async () => {
        const edit = await page("/profile?edit=1");
        assert.match(await edit.text(), /action="\/profile\/edit"/);
        const bad = await page("/profile/edit", {
          method: "POST",
          body: new URLSearchParams({ age: "bad", major: "Mathematics" }),
        });
        assert.equal(bad.status, 400);
        assert.match(await bad.text(), /value="Mathematics"/);
        const saved = await page("/profile/edit", {
          method: "POST",
          body: new URLSearchParams({ age: "21", major: "Mathematics" }),
        });
        assert.equal(saved.status, 303);
        assert.equal(saved.headers.get("location"), "/profile?saved=1");
        assert.match(
          await (await page("/profile?saved=1")).text(),
          /Profile saved/,
        );
        assert.equal((await (await api()).json()).age, 21);
      },
    );
    await t.test("cross-site profile changes are rejected", async () => {
      const res = await page("/profile/edit", {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site" },
        body: new URLSearchParams({ major: "Malicious" }),
      });
      assert.equal(res.status, 403);
      assert.equal((await (await api()).json()).major, "Mathematics");
    });
    await t.test(
      "delete is scoped to the current user and allows recreation with a form",
      async () => {
        assert.equal((await api("DELETE", undefined, bob.cookie)).status, 404);
        assert.equal((await api()).status, 200);
        assert.equal((await api("DELETE")).status, 200);
        assert.equal((await api("DELETE")).status, 404);
        const form = Object.fromEntries(
          Object.entries(valid).map(([key, value]) => [key, String(value)]),
        );
        const res = await page("/profile", {
          method: "POST",
          body: new URLSearchParams(form),
        });
        assert.equal(res.status, 303);
        assert.equal((await api()).status, 200);
      },
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    const rollback = await migrator.migrateTo(NO_MIGRATIONS);
    await db.destroy();
    if (rollback.error) throw rollback.error;
  }
});
