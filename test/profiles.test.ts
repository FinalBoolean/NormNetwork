import assert from "node:assert/strict";
import sharp from "sharp";
import { MAX_PHOTO_BYTES, processPhoto } from "../lib/profile-photo.js";
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
      "enum selections, age boundaries, and major search are validated",
      async () => {
        for (const age of [
          -1,
          0,
          15,
          101,
          120,
          20.5,
          "-16",
          "16.5",
          "1e2",
          "",
          null,
          true,
        ]) {
          assert.equal((await api("PATCH", { age })).status, 400, String(age));
        }
        for (const age of [16, 100])
          assert.equal((await api("PATCH", { age })).status, 200);
        for (const change of [
          { class: "Not a class" },
          { gender: "not-an-option" },
          { major: "Made-up major" },
        ])
          assert.equal((await api("PATCH", change)).status, 400);
        assert.equal(
          (
            await api("PATCH", {
              class: "Graduate",
              gender: "Prefer not to say",
              major: "computer science",
            })
          ).status,
          200,
        );
        assert.equal((await (await api()).json()).major, "Computer Science");
        const edit = await (await page("/profile?edit=1")).text();
        assert.match(edit, /<select[^>]*name="class"/);
        assert.match(edit, /<select[^>]*name="gender"/);
        assert.match(edit, /list="major-options"/);
        assert.match(edit, /value="Computer Science"/);
        assert.doesNotMatch(edit, /name="profile_picture"/);
      },
    );
    await t.test(
      "photo uploads validate content and store only an owner's normalized image",
      async () => {
        const png = await sharp({
          create: { width: 1200, height: 600, channels: 3, background: "red" },
        })
          .png()
          .withExif({ IFD0: { Artist: "Private metadata" } })
          .toBuffer();
        function upload(
          buffer: Buffer,
          cookie = alice.cookie,
          headers: Record<string, string> = {},
          extra = false,
        ) {
          const form = new FormData();
          form.append(
            "photo",
            new Blob([new Uint8Array(buffer)], { type: "image/png" }),
            "photo.png",
          );
          if (extra)
            form.append(
              "photo",
              new Blob([new Uint8Array(buffer)]),
              "second.png",
            );
          return fetch(base + "/profile/photo", {
            method: "POST",
            redirect: "manual",
            headers: { cookie, accept: "application/json", ...headers },
            body: form,
          });
        }
        assert.equal((await upload(png, "")).status, 401);
        assert.equal((await upload(png, bob.cookie)).status, 409);
        assert.equal(
          (await upload(png, alice.cookie, { "sec-fetch-site": "cross-site" }))
            .status,
          403,
        );
        assert.equal((await upload(Buffer.from("not an image"))).status, 400);
        assert.equal(
          (
            await upload(
              Buffer.from(
                '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
              ),
            )
          ).status,
          400,
        );
        assert.equal((await upload(png.subarray(0, 30))).status, 400);
        assert.equal(
          (await upload(Buffer.alloc(MAX_PHOTO_BYTES + 1))).status,
          413,
        );
        assert.equal((await upload(png, alice.cookie, {}, true)).status, 400);
        const missing = await fetch(base + "/profile/photo", {
          method: "POST",
          headers: { cookie: alice.cookie, accept: "application/json" },
          body: new FormData(),
        });
        assert.equal(missing.status, 400);
        const uploaded = await upload(png);
        assert.equal(uploaded.status, 200, await uploaded.text());
        assert.equal(
          (await (await api()).json()).profile_picture,
          "/profile/photo",
        );
        const photo = await page("/profile/photo");
        assert.equal(photo.status, 200);
        assert.equal(photo.headers.get("content-type"), "image/webp");
        assert.equal(photo.headers.get("x-content-type-options"), "nosniff");
        const metadata = await sharp(
          Buffer.from(await photo.arrayBuffer()),
        ).metadata();
        assert.equal(metadata.format, "webp");
        assert.equal(metadata.width, 1024);
        assert.equal(metadata.height, 512);
        assert.equal(metadata.exif, undefined);
        assert.equal(
          (
            await fetch(base + "/profile/photo", {
              headers: { cookie: bob.cookie },
            })
          ).status,
          404,
        );
        assert.equal(
          (await upload(Buffer.from("bad replacement"))).status,
          400,
        );
        assert.equal((await page("/profile/photo")).status, 200);
        assert.equal((await upload(png)).status, 200);
        assert.equal(
          (await db.selectFrom("profile_photos").selectAll().execute()).length,
          1,
        );
        assert.equal((await api("PATCH", { major: "Biology" })).status, 200);
        assert.equal(
          (await (await api()).json()).profile_picture,
          "/profile/photo",
        );
        const browserForm = new FormData();
        browserForm.append(
          "photo",
          new Blob([new Uint8Array(png)]),
          "avatar.png",
        );
        const browserUpload = await page("/profile/photo", {
          method: "POST",
          body: browserForm,
        });
        assert.equal(browserUpload.status, 303);
        assert.equal(browserUpload.headers.get("location"), "/profile?saved=1");
      },
    );
    await t.test(
      "delete is scoped to the current user and allows recreation with a form",
      async () => {
        assert.equal((await api("DELETE", undefined, bob.cookie)).status, 404);
        assert.equal((await api()).status, 200);
        assert.equal((await api("DELETE")).status, 200);
        assert.equal(
          (await db.selectFrom("profile_photos").selectAll().execute()).length,
          0,
        );
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

test("photo decoder rejects excessive dimensions and animations", async () => {
  const oversized = await sharp({
    create: { width: 5000, height: 4001, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await assert.rejects(processPhoto(oversized), { status: 400 });
  const animated = await sharp(Buffer.from([255, 0, 0, 0, 255, 0]), {
    raw: { width: 1, height: 2, channels: 3, pageHeight: 1 },
  })
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
  await assert.rejects(processPhoto(animated), { status: 400 });
  for (const format of ["jpeg", "png", "webp"] as const) {
    const input = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "blue" },
    })
      .toFormat(format)
      .toBuffer();
    assert.equal(
      (await sharp(await processPhoto(input)).metadata()).format,
      "webp",
    );
  }
});
