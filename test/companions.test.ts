import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { NO_MIGRATIONS } from "kysely/migration";
import { createApp } from "../app.js";
import { createMigrator } from "../db/migrator.js";
import { createSession, SESSION_COOKIE } from "../lib/sessions.js";
import { createTestDatabase } from "./helpers/db.js";

// React escapes quotes; undo that so assertions can use normal text.
const decode = (html: string) =>
  html
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");

/** True if the page has an <input value="..."> with the given attribute, in any order. */
const inputHas = (html: string, value: string, attribute: "checked" | "disabled") =>
  new RegExp(
    `<input(?=[^>]*\\b${attribute}="")(?=[^>]*value="${value}")[^>]*>`,
  ).test(html);

test("companion types, partner profiles, and dating preferences", async (t) => {
  const db = createTestDatabase();
  const migrator = createMigrator(db);
  const migration = await migrator.migrateToLatest();
  if (migration.error) throw migration.error;
  const server = createApp({ db }).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;

  async function account(username: string, age?: number) {
    const user = await db
      .insertInto("users")
      .values({
        username,
        email: `${username}@charlotte.edu`,
        password_hash: "unused-in-this-test",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    if (age !== undefined)
      await db
        .insertInto("profiles")
        .values({
          user_id: user.id,
          age,
          class: "Junior",
          gender: "Woman",
          major: "Computer Science",
        })
        .execute();
    const { token } = await createSession(db, user.id);
    return { user, cookie: `${SESSION_COOKIE}=${token}` };
  }
  const alice = await account("companion_alice", 20);
  const bob = await account("companion_bob", 22);
  const teen = await account("companion_teen", 17);
  const newcomer = await account("companion_new");

  function api(
    path: string,
    method = "GET",
    body?: unknown,
    cookie = alice.cookie,
  ) {
    return fetch(`${base}/profile${path}`, {
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
  function page(path: string, cookie = alice.cookie, init: RequestInit = {}) {
    return fetch(base + path, {
      redirect: "manual",
      ...init,
      headers: { cookie, ...init.headers },
    });
  }
  function form(path: string, fields: [string, string][], cookie = alice.cookie) {
    return page(path, cookie, {
      method: "POST",
      body: new URLSearchParams(fields),
    });
  }
  const types = async (cookie = alice.cookie) =>
    (await (await api("/companions", "GET", undefined, cookie)).json())
      .companion_types;

  try {
    await t.test("every route needs a session", async () => {
      for (const path of ["/companions"]) {
        for (const method of ["GET", "PUT", "DELETE"])
          assert.equal(
            (await api(path, method, method === "PUT" ? {} : undefined, ""))
              .status,
            401,
            `${method} ${path}`,
          );
        const res = await page(`/profile${path}`, "");
        assert.equal(res.status, 302);
        assert.equal(
          res.headers.get("location"),
          `/login?next=${encodeURIComponent(`/profile${path}`)}`,
        );
      }
    });

    await t.test("a main profile is required first", async () => {
      const c = newcomer.cookie;
      assert.equal((await api("/companions", "GET", undefined, c)).status, 404);
      assert.equal(
        (await api("/companions", "PUT", { companion_types: ["friends"] }, c))
          .status,
        409,
      );
      for (const path of ["/companions"]) {
        const res = await page(`/profile${path}`, c);
        assert.equal(res.status, 302, path);
        assert.equal(res.headers.get("location"), "/profile");
      }
    });

    await t.test("creating a profile leads to companion selection", async () => {
      const res = await form(
        "/profile",
        [
          ["age", "19"],
          ["class", "Freshman"],
          ["gender", "Man"],
          ["major", "Computer Science"],
        ],
        newcomer.cookie,
      );
      assert.equal(res.status, 303);
      assert.equal(res.headers.get("location"), "/profile/companions?welcome=1");
      const html = decode(
        await (
          await page("/profile/companions?welcome=1", newcomer.cookie)
        ).text(),
      );
      assert.match(html, /Next, choose what you're looking for/);
      assert.match(html, /Who do you want to meet\?/);
      assert.deepEqual(await types(newcomer.cookie), []);
    });

    await t.test("companion types are validated and replaced as a set", async () => {
      for (const body of [
        {},
        { companion_types: [] },
        { companion_types: "" },
        { companion_types: ["roommates"] },
        { companion_types: [1] },
        { companion_types: { study: true } },
        [],
      ])
        assert.equal(
          (await api("/companions", "PUT", body)).status,
          400,
          JSON.stringify(body),
        );
      const saved = await api("/companions", "PUT", {
        companion_types: ["gaming", "Friends", "gaming"],
      });
      assert.equal(saved.status, 200);
      assert.deepEqual((await saved.json()).companion_types, [
        "friends",
        "gaming",
      ]);
      // Comma-separated strings work too, and replace the previous set.
      await api("/companions", "PUT", { companion_types: "study, friends" });
      assert.deepEqual(await types(), ["friends", "study"]);
      assert.deepEqual(await types(bob.cookie), []);
    });

    await t.test("the companion form saves checkboxes and keeps choices on errors", async () => {
      const bad = await form("/profile/companions", []);
      assert.equal(bad.status, 400);
      assert.match(
        decode(await bad.text()),
        /Choose at least one thing you're looking for/,
      );
      const saved = await form("/profile/companions", [
        ["companion_types", "friends"],
        ["companion_types", "study"],
        ["companion_types", "dating"],
      ]);
      assert.equal(saved.status, 303);
      assert.equal(saved.headers.get("location"), "/profile?saved=companions");
      assert.deepEqual(await types(), ["friends", "study", "dating"]);
      const html = await (await page("/profile/companions")).text();
      for (const type of ["friends", "study", "dating"])
        assert.ok(inputHas(html, type, "checked"), type);
      assert.ok(!inputHas(html, "gaming", "checked"));
      const profile = decode(await (await page("/profile?saved=companions")).text());
      assert.match(profile, /Saved what you're looking for/);
      assert.match(profile, /Friends · Study partners · Dating/);
      assert.match(profile, /href="\/profile\/companions"/);
    });

    await t.test("dating is limited to students 18 and older", async () => {
      assert.equal(
        (
          await api(
            "/companions",
            "PUT",
            { companion_types: ["friends", "dating"] },
            teen.cookie,
          )
        ).status,
        400,
      );
      const html = await (await page("/profile/companions", teen.cookie)).text();
      assert.ok(inputHas(html, "dating", "disabled"));
      assert.match(html, /Only open to students 18 and older/);
    });

    await t.test("an age below 18 turns dating off", async () => {
      await api("/companions", "PUT", { companion_types: ["friends", "dating"] });
      const res = await fetch(`${base}/profile`, {
        method: "PATCH",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          cookie: alice.cookie,
        },
        body: JSON.stringify({ age: 17 }),
      });
      assert.equal(res.status, 200);
      assert.deepEqual(await types(), ["friends"]);
      await fetch(`${base}/profile`, {
        method: "PATCH",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          cookie: alice.cookie,
        },
        body: JSON.stringify({ age: 20 }),
      });
    });

    await t.test("cross-site changes are rejected", async () => {
      const before = await types();
      for (const path of ["/profile/companions"]) {
        const res = await page(path, alice.cookie, {
          method: "POST",
          headers: { "sec-fetch-site": "cross-site" },
          body: new URLSearchParams({ companion_types: "friends", subject: "x" }),
        });
        assert.equal(res.status, 403, path);
      }
      assert.deepEqual(await types(), before);
    });

    await t.test("deleting the main profile removes everything", async () => {
      await api("/companions", "PUT", { companion_types: ["friends"] });
      assert.equal((await api("", "DELETE")).status, 200);
      for (const table of [
        "companion_types",
      ] as const)
        assert.equal(
          (
            await db
              .selectFrom(table)
              .selectAll()
              .where("user_id", "=", alice.user.id)
              .execute()
          ).length,
          0,
          table,
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
