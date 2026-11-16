import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { NO_MIGRATIONS } from "kysely/migration";
import { createApp } from "../app.js";
import { createMigrator } from "../db/migrator.js";
import { createSession, SESSION_COOKIE } from "../lib/sessions.js";
import { PHOTO_URL } from "../lib/profile-photo.js";
import { findStudyBuddies } from "../lib/study-finder.js";
import { createTestDatabase } from "./helpers/db.js";

test("study buddy finder", async (t) => {
  const db = createTestDatabase();
  const migrator = createMigrator(db);
  const migration = await migrator.migrateToLatest();
  if (migration.error) throw migration.error;
  const server = createApp({ db }).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;

  /** A student with a main profile and, if `courses` is given, a study partner profile. */
  async function student(
    username: string,
    {
      courses,
      subject = "Data structures",
      major = "Computer Science",
      studyOn = true,
      photo,
      bio = null,
      additional_info = null,
    }: {
      courses?: string;
      subject?: string;
      major?: string;
      studyOn?: boolean;
      photo?: "uploaded" | "external";
      bio?: string | null;
      additional_info?: string | null;
    } = {},
  ) {
    const user = await db
      .insertInto("users")
      .values({
        username,
        email: `${username}@charlotte.edu`,
        password_hash: "unused-in-this-test",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    const profile = await db
      .insertInto("profiles")
      .values({
        user_id: user.id,
        age: 20,
        class: "Junior",
        gender: "Woman",
        major,
        bio,
        profile_picture:
          photo === "uploaded"
            ? PHOTO_URL
            : photo === "external"
              ? "https://example.com/me.png"
              : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    if (photo === "uploaded")
      await db
        .insertInto("profile_photos")
        .values({ profile_id: profile.id, image: Buffer.from(`photo of ${username}`) })
        .execute();
    if (courses) {
      await db
        .insertInto("study_finder")
        .values({
          user_id: user.id,
          subject,
          course: courses,
          additional_info,
          availability: "Tue & Thu, 4–6 PM",
          meeting_place: "Atkins Library",
        })
        .execute();
      if (studyOn)
        await db
          .insertInto("companion_types")
          .values({ user_id: user.id, type: "study" })
          .execute();
    }
    const { token } = await createSession(db, user.id);
    return { user, cookie: `${SESSION_COOKIE}=${token}` };
  }

  const viewer = await student("finder_viewer", {
    courses: "ITSC 2214, ITSC 3155",
  });
  const maya = await student("finder_maya", {
    courses: "ITSC 3155, ITSC 2214, MATH 1241",
    photo: "uploaded",
    bio: "Quiz me on trees! <script>alert(1)</script>",
    additional_info: "Big-O questions before the midterm",
  });
  const aaron = await student("finder_aaron", {
    courses: "ITSC 3155",
    subject: "Algorithms",
    photo: "external",
  });
  const leo = await student("finder_leo", {
    courses: "ITSC 1212",
    major: "Data Science",
  });
  const paused = await student("finder_paused", {
    courses: "ITSC 3155",
    studyOn: false,
    photo: "uploaded",
  });
  const noStudy = await student("finder_nostudy");

  function get(path: string, cookie = viewer.cookie, json = true) {
    return fetch(base + path, {
      redirect: "manual",
      headers: { cookie, accept: json ? "application/json" : "text/html" },
    });
  }
  async function results(query = "", cookie = viewer.cookie) {
    const res = await get(`/finder/study${query}`, cookie);
    assert.equal(res.status, 200, query);
    return res.json();
  }
  const names = (body: { results: { username: string }[] }) =>
    body.results.map((match) => match.username);

  try {
    await t.test("login is required", async () => {
      const page = await get("/finder/study", "", false);
      assert.equal(page.status, 302);
      assert.equal(
        page.headers.get("location"),
        `/login?next=${encodeURIComponent("/finder/study")}`,
      );
      assert.equal((await get("/finder/study", "")).status, 401);
      assert.equal(
        (await get(`/finder/study/${maya.user.id}/photo`, "")).status,
        401,
      );
    });

    await t.test(
      "shows students with study partners turned on, most shared courses first",
      async () => {
        const body = await results();
        // Not the viewer, not a paused profile, not someone without one.
        assert.deepEqual(names(body), ["finder_maya", "finder_aaron", "finder_leo"]);
        const [first, second, third] = body.results;
        assert.deepEqual(first.courses, ["ITSC 3155", "ITSC 2214", "MATH 1241"]);
        assert.deepEqual(first.shared_courses, ["ITSC 3155", "ITSC 2214"]);
        assert.deepEqual(second.shared_courses, ["ITSC 3155"]);
        assert.deepEqual(third.shared_courses, []);
        assert.equal(body.page, 1);
        assert.equal(body.has_more, false);
      },
    );

    await t.test("never shares email, age, or gender", async () => {
      const [first] = (await results()).results;
      assert.deepEqual(Object.keys(first).sort(), [
        "additional_info",
        "availability",
        "bio",
        "class",
        "courses",
        "major",
        "meeting_place",
        "photo",
        "shared_courses",
        "subject",
        "user_id",
        "username",
      ]);
      const text = JSON.stringify(await results());
      assert.ok(!text.includes("@charlotte.edu"));
      assert.ok(!text.includes("password"));
    });

    await t.test("students without a study profile still see others", async () => {
      const body = await results("", noStudy.cookie);
      assert.deepEqual(names(body), [
        "finder_aaron",
        "finder_leo",
        "finder_maya",
        "finder_viewer",
      ]);
      assert.ok(body.results.every((m: { shared_courses: string[] }) => !m.shared_courses.length));
    });

    await t.test("filters by course, in any format", async () => {
      for (const course of ["ITSC 3155", "itsc3155", "itsc-3155"]) {
        const body = await results(`?course=${encodeURIComponent(course)}`);
        assert.deepEqual(names(body), ["finder_maya", "finder_aaron"], course);
        assert.equal(body.course, "ITSC 3155");
      }
      assert.deepEqual(names(await results("?course=MATH%201241")), ["finder_maya"]);
      assert.deepEqual(names(await results("?course=ITSC%209999")), []);
    });

    await t.test("rejects a course filter that isn't a course code", async () => {
      const res = await get("/finder/study?course=banana");
      assert.equal(res.status, 400);
      assert.match((await res.json()).errors.course, /isn't a course code/);
      const page = await get("/finder/study?course=banana", viewer.cookie, false);
      assert.equal(page.status, 400);
      assert.match(await page.text(), /isn(?:&#x27;|')t a course code/);
    });

    await t.test("searches subject, courses, major, username, and help needed", async () => {
      assert.deepEqual(names(await results("?q=ALGOR")), ["finder_aaron"]);
      assert.deepEqual(names(await results("?q=data%20science")), ["finder_leo"]);
      assert.deepEqual(names(await results("?q=leo")), ["finder_leo"]);
      assert.deepEqual(names(await results("?q=itsc1212")), ["finder_leo"]);
      assert.deepEqual(names(await results("?q=big-o")), ["finder_maya"]);
      // Search and course filter work together
      assert.deepEqual(
        names(await results("?q=algorithms&course=ITSC%203155")),
        ["finder_aaron"],
      );
      // % and _ are matched literally, not as wildcards
      assert.deepEqual(names(await results("?q=%25")), []);
      assert.deepEqual(names(await results("?q=fi_der")), []);
      assert.deepEqual(names(await results("?q=der_ma")), ["finder_maya"]);
    });

    await t.test("pages through results without repeats", async () => {
      const seen: string[] = [];
      for (let page = 1; page <= 3; page++) {
        const { matches, hasMore } = await findStudyBuddies(db, viewer.user.id, {
          myCourses: ["ITSC 2214", "ITSC 3155"],
          page,
          pageSize: 1,
        });
        seen.push(...matches.map((m) => m.username));
        assert.equal(hasMore, page < 3, `page ${page}`);
      }
      assert.deepEqual(seen, ["finder_maya", "finder_aaron", "finder_leo"]);

      const later = await results("?page=2");
      assert.deepEqual(names(later), []);
      assert.equal(later.page, 2);
      assert.equal((await results("?page=abc")).page, 1);
      assert.equal((await results("?page=0")).page, 1);
    });

    await t.test("shows uploaded photos only while a student can be found", async () => {
      const byName = Object.fromEntries(
        (await results()).results.map((m: { username: string }) => [m.username, m]),
      );
      const photoUrl = `/finder/study/${maya.user.id}/photo`;
      assert.equal(byName.finder_maya.photo, photoUrl);
      // External photo URLs are never shown to other students
      assert.equal(byName.finder_aaron.photo, null);
      assert.equal(byName.finder_leo.photo, null);

      const photo = await get(photoUrl);
      assert.equal(photo.status, 200);
      assert.equal(photo.headers.get("content-type"), "image/webp");
      assert.equal(photo.headers.get("cache-control"), "private, no-store");
      assert.equal(await photo.text(), "photo of finder_maya");

      for (const id of [
        paused.user.id, // has a photo, but study partners is turned off
        aaron.user.id,
        leo.user.id,
        noStudy.user.id,
        "abc",
        "0",
        "99999999999",
      ])
        assert.equal((await get(`/finder/study/${id}/photo`)).status, 404, String(id));
    });

    await t.test("the page shows real students instead of sample data", async () => {
      const res = await get("/finder/study", viewer.cookie, false);
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.match(html, /finder_maya/);
      assert.match(html, /2 courses in common/);
      assert.match(html, /LOOKING FOR HELP WITH/);
      assert.doesNotMatch(html, /Maya Patel/);
      // The viewer's own courses are quick filters
      assert.match(html, /href="\/finder\/study\?course=ITSC\+2214"/);
      assert.doesNotMatch(html, /can(?:&#x27;|')t find you here yet/);
      // A bio can't inject a script
      assert.doesNotMatch(html, /<script>alert\(1\)/);

      const newcomer = await (await get("/finder/study", noStudy.cookie, false)).text();
      assert.match(newcomer, /can(?:&#x27;|')t find you here yet/);
      assert.match(newcomer, /href="\/profile\/study"/);

      const empty = await (
        await get("/finder/study?q=nobody-matches-this", viewer.cookie, false)
      ).text();
      assert.match(empty, /No study buddies found/);
    });

    await t.test("removing a study profile takes the student off the finder", async () => {
      const res = await fetch(`${base}/profile/study`, {
        method: "DELETE",
        headers: { accept: "application/json", cookie: maya.cookie },
      });
      assert.equal(res.status, 200);
      assert.deepEqual(names(await results()), ["finder_aaron", "finder_leo"]);
      assert.equal(
        (await get(`/finder/study/${maya.user.id}/photo`)).status,
        404,
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
