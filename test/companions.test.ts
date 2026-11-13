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

  const study = {
    subject: "Data structures",
    course: "itsc2214, ITSC-3155, itsc 2214",
    additional_info: "Quiz each other before the midterm.",
    availability: "Tue & Thu, 4–6 PM",
    meeting_place: "Atkins Library, 3rd floor",
  };
  const gaming = {
    games: "VALORANT, Minecraft, valorant",
    platforms: ["pc", "Nintendo Switch"],
    rank: "Diamond 2",
    main_character: "Omen",
    main_role: "Controller",
    play_style: "competitive",
    voice_chat: "Mic on",
    availability: "Evenings",
  };
  const dating = {
    interested_in: ["Women", "Everyone"],
    age_min: 19,
    age_max: 24,
    looking_for: "Something casual",
  };

  try {
    await t.test("every route needs a session", async () => {
      for (const path of ["/companions", "/study", "/gaming", "/dating"]) {
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
      assert.equal((await api("/study", "PUT", study, c)).status, 409);
      assert.equal((await api("/gaming", "PUT", gaming, c)).status, 409);
      assert.equal((await api("/dating", "PUT", dating, c)).status, 409);
      for (const path of ["/companions", "/study", "/gaming", "/dating"]) {
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
      assert.match(profile, /Not set up/);
      assert.match(profile, /href="\/profile\/study"/);
    });

    await t.test("study profiles validate courses and fields", async () => {
      for (const invalid of [
        {},
        [],
        { ...study, subject: " " },
        { ...study, subject: "x".repeat(101) },
        { ...study, course: "" },
        { ...study, course: "Data Structures" },
        { ...study, course: "ITSC 31555" },
        { ...study, course: "A 1234" },
        { ...study, course: "MATH 1241, MATH 1242, ITSC 1212, ITSC 1213, ITSC 2214, ITSC 2175" },
        { ...study, course: 3155 },
        { ...study, additional_info: "x".repeat(1001) },
        { ...study, availability: ["Monday"] },
        { ...study, meeting_place: "x".repeat(101) },
      ])
        assert.equal(
          (await api("/study", "PUT", invalid)).status,
          400,
          JSON.stringify(invalid).slice(0, 80),
        );
      assert.equal((await api("/study")).status, 404);
    });

    await t.test("study profiles save, update, and belong to their owner", async () => {
      await api("/companions", "PUT", { companion_types: ["friends"] });
      const res = await api("/study", "PUT", { ...study, user_id: bob.user.id });
      assert.equal(res.status, 200);
      const saved = await res.json();
      assert.equal(saved.user_id, alice.user.id);
      assert.equal(saved.course, "ITSC 2214, ITSC 3155");
      assert.equal(saved.meeting_place, study.meeting_place);
      // Saving turns the study companion type on.
      assert.deepEqual(await types(), ["friends", "study"]);
      const updated = await (
        await api("/study", "PUT", {
          subject: "Calculus",
          course: "MATH 1241",
          availability: "",
        })
      ).json();
      assert.equal(updated.subject, "Calculus");
      assert.equal(updated.availability, null);
      assert.equal(updated.additional_info, null);
      assert.equal((await api("/study", "GET", undefined, bob.cookie)).status, 404);
      assert.equal(
        (await db.selectFrom("study_finder").selectAll().execute()).length,
        1,
      );
    });

    await t.test("the study form keeps entered values and redirects on save", async () => {
      const edit = await (await page("/profile/study")).text();
      assert.match(edit, /action="\/profile\/study"/);
      assert.match(edit, /value="MATH 1241"/);
      assert.match(edit, /action="\/profile\/study\/delete"/);
      const bad = await form("/profile/study", [
        ["subject", "Statistics"],
        ["course", "not a course"],
      ]);
      assert.equal(bad.status, 400);
      const html = decode(await bad.text());
      assert.match(html, /value="Statistics"/);
      assert.match(html, /isn't a course code/);
      const saved = await form("/profile/study", Object.entries(study));
      assert.equal(saved.status, 303);
      assert.equal(saved.headers.get("location"), "/profile?saved=study");
      const profile = decode(await (await page("/profile?saved=study")).text());
      assert.match(profile, /Study partner profile saved/);
      assert.match(profile, /ITSC 2214, ITSC 3155/);
      assert.match(profile, /Atkins Library, 3rd floor/);
    });

    await t.test("gaming profiles validate games, platforms, and choices", async () => {
      for (const invalid of [
        {},
        { ...gaming, games: "" },
        { ...gaming, games: "A, B, C, D, E, F" },
        { ...gaming, games: "x".repeat(51) },
        { ...gaming, platforms: [] },
        { ...gaming, platforms: ["Dreamcast"] },
        { ...gaming, platforms: [1] },
        { ...gaming, play_style: "Sweaty" },
        { ...gaming, play_style: undefined },
        { ...gaming, voice_chat: "Carrier pigeon" },
        { ...gaming, rank: "x".repeat(51) },
        { ...gaming, main_role: {} },
      ])
        assert.equal(
          (await api("/gaming", "PUT", invalid)).status,
          400,
          JSON.stringify(invalid).slice(0, 80),
        );
      const res = await api("/gaming", "PUT", { ...gaming, rank: " " });
      assert.equal(res.status, 200);
      const saved = await res.json();
      assert.equal(saved.games, "VALORANT, Minecraft");
      assert.equal(saved.platforms, "PC, Nintendo Switch");
      assert.equal(saved.play_style, "Competitive");
      assert.equal(saved.rank, null);
      assert.deepEqual(await types(), ["friends", "study", "gaming"]);
      const profile = await (await page("/profile")).text();
      assert.match(profile, /Unranked/);
      assert.match(profile, /VALORANT, Minecraft/);
    });

    await t.test("the gaming form round-trips checkboxes and selects", async () => {
      const bad = await form("/profile/gaming", [
        ["games", "Rocket League"],
        ["platforms", "Xbox"],
        ["platforms", "PC"],
        ["play_style", "Casual"],
      ]);
      assert.equal(bad.status, 400);
      const html = decode(await bad.text());
      assert.match(html, /value="Rocket League"/);
      assert.ok(inputHas(html, "Xbox", "checked"));
      assert.ok(inputHas(html, "PC", "checked"));
      assert.ok(!inputHas(html, "Mobile", "checked"));
      assert.match(html, /<option value="Casual" selected="">/);
      assert.match(html, /Choose how you like to communicate/);
      const saved = await form("/profile/gaming", [
        ["games", "Rocket League"],
        ["platforms", "Xbox"],
        ["play_style", "Casual"],
        ["voice_chat", "Either"],
      ]);
      assert.equal(saved.status, 303);
      assert.equal(saved.headers.get("location"), "/profile?saved=gaming");
      const row = await (await api("/gaming")).json();
      assert.equal(row.platforms, "Xbox");
      assert.equal(row.main_character, null);
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
      assert.equal((await api("/dating", "GET", undefined, teen.cookie)).status, 403);
      assert.equal((await api("/dating", "PUT", dating, teen.cookie)).status, 403);
      assert.equal((await page("/profile/dating", teen.cookie)).status, 403);
      assert.equal(
        (await db.selectFrom("dating_preferences").selectAll().execute()).length,
        0,
      );
      const html = await (await page("/profile/companions", teen.cookie)).text();
      assert.ok(inputHas(html, "dating", "disabled"));
      assert.match(html, /Only open to students 18 and older/);
    });

    await t.test("dating preferences validate the age range and choices", async () => {
      for (const invalid of [
        {},
        { ...dating, interested_in: [] },
        { ...dating, interested_in: ["Robots"] },
        { ...dating, age_min: 17 },
        { ...dating, age_min: "17" },
        { ...dating, age_max: 101 },
        { ...dating, age_min: 25, age_max: 20 },
        { ...dating, age_min: 20.5 },
        { ...dating, age_min: "1e2" },
        { ...dating, age_max: null },
        { ...dating, looking_for: "A green card" },
      ])
        assert.equal(
          (await api("/dating", "PUT", invalid)).status,
          400,
          JSON.stringify(invalid),
        );
      const res = await api("/dating", "PUT", dating);
      assert.equal(res.status, 200);
      const saved = await res.json();
      // "Everyone" already covers the other choices.
      assert.equal(saved.interested_in, "Everyone");
      assert.equal(saved.age_min, 19);
      const html = decode(await (await page("/profile/dating")).text());
      assert.match(html, /Only you can see these preferences/);
      assert.ok(inputHas(html, "Everyone", "checked"));
      assert.match(html, /value="19"/);
      assert.equal((await api("/dating", "GET", undefined, bob.cookie)).status, 404);
    });

    await t.test("the dating form saves, and suggests ages near your own", async () => {
      const fresh = decode(await (await page("/profile/dating", bob.cookie)).text());
      assert.match(fresh, /Set up dating/);
      assert.match(fresh, /name="age_min" value="19"/);
      assert.match(fresh, /name="age_max" value="25"/);
      const saved = await form(
        "/profile/dating",
        [
          ["interested_in", "Men"],
          ["interested_in", "Non-binary people"],
          ["age_min", "20"],
          ["age_max", "26"],
          ["looking_for", "Long-term relationship"],
        ],
        bob.cookie,
      );
      assert.equal(saved.status, 303);
      assert.equal(saved.headers.get("location"), "/profile?saved=dating");
      const row = await (await api("/dating", "GET", undefined, bob.cookie)).json();
      assert.equal(row.interested_in, "Men, Non-binary people");
      assert.deepEqual(await types(bob.cookie), ["dating"]);
    });

    await t.test("turning a type off pauses it and keeps its details", async () => {
      await api("/companions", "PUT", { companion_types: ["friends"] });
      assert.deepEqual(await types(), ["friends"]);
      assert.equal((await api("/study")).status, 200);
      const html = await (await page("/profile")).text();
      assert.match(html, /Paused/);
    });

    await t.test("an age below 18 turns dating off and deletes preferences", async () => {
      await api("/companions", "PUT", { companion_types: ["friends", "dating"] });
      assert.equal((await api("/dating")).status, 200);
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
      assert.equal(
        (
          await db
            .selectFrom("dating_preferences")
            .selectAll()
            .where("user_id", "=", alice.user.id)
            .execute()
        ).length,
        0,
      );
      assert.equal((await api("/dating")).status, 403);
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

    await t.test("removing a profile deletes it and turns its type off", async () => {
      await api("/companions", "PUT", { companion_types: ["study", "gaming"] });
      const removed = await api("/study", "DELETE");
      assert.equal(removed.status, 200);
      assert.equal((await removed.json()).studyProfile.subject, "Data structures");
      assert.equal((await api("/study", "DELETE")).status, 404);
      assert.deepEqual(await types(), ["gaming"]);
      const html = await form("/profile/gaming/delete", []);
      assert.equal(html.status, 303);
      assert.equal(html.headers.get("location"), "/profile?removed=gaming");
      assert.match(
        await (await page("/profile?removed=gaming")).text(),
        /Gaming partner profile removed/,
      );
      assert.equal((await api("/gaming")).status, 404);
      assert.deepEqual(await types(), []);
      assert.equal((await api("/dating", "DELETE", undefined, bob.cookie)).status, 200);
      assert.deepEqual(await types(bob.cookie), []);
    });

    await t.test("cross-site changes are rejected", async () => {
      const before = await types();
      for (const path of ["/profile/companions", "/profile/study", "/profile/dating/delete"]) {
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
      await api("/companions", "PUT", { companion_types: ["friends", "dating"] });
      await api("/study", "PUT", study);
      await api("/gaming", "PUT", gaming);
      await api("/dating", "PUT", dating);
      assert.equal((await api("", "DELETE")).status, 200);
      for (const table of [
        "companion_types",
        "study_finder",
        "gaming_finder",
        "dating_preferences",
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
