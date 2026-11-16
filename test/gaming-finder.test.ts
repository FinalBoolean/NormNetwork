import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { NO_MIGRATIONS } from "kysely/migration";
import { createApp } from "../app.js";
import { createMigrator } from "../db/migrator.js";
import { createSession, SESSION_COOKIE } from "../lib/sessions.js";
import { PHOTO_URL } from "../lib/profile-photo.js";
import { findGamingPartners } from "../lib/gaming-finder.js";
import { createTestDatabase } from "./helpers/db.js";

test("gaming partner finder", async (t) => {
  const db = createTestDatabase();
  const migrator = createMigrator(db);
  const migration = await migrator.migrateToLatest();
  if (migration.error) throw migration.error;
  const server = createApp({ db }).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;

  /** A student with a main profile and, if `games` is given, a gaming partner profile. */
  async function student(
    username: string,
    {
      games,
      platforms = "PC",
      rank = null,
      main_role = null,
      main_character = null,
      play_style = "Casual",
      voice_chat = "Mic on",
      availability = "Evenings",
      major = "Computer Science",
      gamingOn = true,
      photo,
    }: {
      games?: string;
      platforms?: string | null;
      rank?: string | null;
      main_role?: string | null;
      main_character?: string | null;
      play_style?: string | null;
      voice_chat?: string | null;
      availability?: string | null;
      major?: string;
      gamingOn?: boolean;
      photo?: "uploaded" | "external";
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
        class: "Sophomore",
        gender: "Man",
        major,
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
    if (games) {
      await db
        .insertInto("gaming_finder")
        .values({
          user_id: user.id,
          games,
          platforms,
          rank,
          main_role,
          main_character,
          play_style,
          voice_chat,
          availability,
        })
        .execute();
      if (gamingOn)
        await db
          .insertInto("companion_types")
          .values({ user_id: user.id, type: "gaming" })
          .execute();
    }
    const { token } = await createSession(db, user.id);
    return { user, cookie: `${SESSION_COOKIE}=${token}` };
  }

  const viewer = await student("gamer_viewer", {
    games: "VALORANT, Minecraft",
    platforms: "PC, Nintendo Switch",
  });
  const jordan = await student("gamer_jordan", {
    games: "valorant, Minecraft, Rocket League",
    platforms: "PC",
    rank: "Diamond 2",
    main_role: "Controller",
    main_character: "Omen",
    play_style: "Competitive",
    photo: "uploaded",
  });
  const sam = await student("gamer_sam", {
    games: "Minecraft",
    platforms: "Xbox",
    voice_chat: "Text chat only",
    photo: "external",
  });
  const riley = await student("gamer_riley", {
    games: "Fortnite",
    platforms: "Nintendo Switch, Mobile",
    major: "Psychology",
    availability: null,
  });
  const casey = await student("gamer_casey", {
    games: "Hollow_Knight",
    platforms: "PlayStation",
  });
  const paused = await student("gamer_paused", {
    games: "VALORANT",
    gamingOn: false,
    photo: "uploaded",
  });
  const noGaming = await student("gamer_nogaming");

  function get(path: string, cookie = viewer.cookie, json = true) {
    return fetch(base + path, {
      redirect: "manual",
      headers: { cookie, accept: json ? "application/json" : "text/html" },
    });
  }
  async function results(query = "", cookie = viewer.cookie) {
    const res = await get(`/finder/gaming${query}`, cookie);
    assert.equal(res.status, 200, query);
    return res.json();
  }
  const names = (body: { results: { username: string }[] }) =>
    body.results.map((match) => match.username);

  try {
    await t.test("login is required", async () => {
      const page = await get("/finder/gaming", "", false);
      assert.equal(page.status, 302);
      assert.equal(
        page.headers.get("location"),
        `/login?next=${encodeURIComponent("/finder/gaming")}`,
      );
      assert.equal((await get("/finder/gaming", "")).status, 401);
      assert.equal(
        (await get(`/finder/gaming/${jordan.user.id}/photo`, "")).status,
        401,
      );
    });

    await t.test(
      "shows students with gaming partners turned on, most shared games first",
      async () => {
        const body = await results();
        // Shared games first (any letter case), then shared platforms, then by name.
        // Not the viewer, not a paused profile, not someone without one.
        assert.deepEqual(names(body), [
          "gamer_jordan", // 2 games
          "gamer_sam", // 1 game
          "gamer_riley", // 0 games, shares Nintendo Switch
          "gamer_casey", // nothing shared
        ]);
        const [first, second, third, fourth] = body.results;
        assert.deepEqual(first.games, ["valorant", "Minecraft", "Rocket League"]);
        assert.deepEqual(first.shared_games, ["valorant", "Minecraft"]);
        assert.deepEqual(first.shared_platforms, ["PC"]);
        assert.equal(first.rank, "Diamond 2");
        assert.deepEqual(second.shared_games, ["Minecraft"]);
        assert.deepEqual(third.shared_games, []);
        assert.deepEqual(third.shared_platforms, ["Nintendo Switch"]);
        assert.equal(third.availability, null);
        assert.deepEqual(fourth.shared_platforms, []);
        assert.equal(body.page, 1);
        assert.equal(body.has_more, false);
      },
    );

    await t.test("never shares email, age, or gender", async () => {
      const [first] = (await results()).results;
      assert.deepEqual(Object.keys(first).sort(), [
        "availability",
        "bio",
        "class",
        "games",
        "main_character",
        "main_role",
        "major",
        "photo",
        "platforms",
        "play_style",
        "rank",
        "shared_games",
        "shared_platforms",
        "user_id",
        "username",
        "voice_chat",
      ]);
      const text = JSON.stringify(await results());
      assert.ok(!text.includes("@charlotte.edu"));
      assert.ok(!text.includes("password"));
    });

    await t.test("students without a gaming profile still see others", async () => {
      const body = await results("", noGaming.cookie);
      assert.deepEqual(names(body), [
        "gamer_casey",
        "gamer_jordan",
        "gamer_riley",
        "gamer_sam",
        "gamer_viewer",
      ]);
    });

    await t.test("filters by game in any letter case, and by platform", async () => {
      for (const game of ["VALORANT", "valorant", "Valorant"])
        assert.deepEqual(
          names(await results(`?game=${game}`)),
          ["gamer_jordan"],
          game,
        );
      assert.deepEqual(names(await results("?game=minecraft")), [
        "gamer_jordan",
        "gamer_sam",
      ]);
      // A game name has to match a whole game, not part of one
      assert.deepEqual(names(await results("?game=Mine")), []);
      assert.deepEqual(names(await results("?platform=xbox")), ["gamer_sam"]);
      assert.equal((await results("?platform=xbox")).platform, "Xbox");
      assert.deepEqual(
        names(await results("?game=Minecraft&platform=PC")),
        ["gamer_jordan"],
      );
    });

    await t.test("rejects an unknown platform or a too-long game", async () => {
      const res = await get("/finder/gaming?platform=Dreamcast");
      assert.equal(res.status, 400);
      assert.match((await res.json()).errors.platform, /Choose a platform/);
      const long = await get(`/finder/gaming?game=${"x".repeat(51)}`);
      assert.equal(long.status, 400);
      assert.match((await long.json()).errors.game, /at most 50/);
      const page = await get("/finder/gaming?platform=Dreamcast", viewer.cookie, false);
      assert.equal(page.status, 400);
      assert.match(await page.text(), /Choose a platform/);
    });

    await t.test("searches games, rank, role, character, comms, major, and username", async () => {
      assert.deepEqual(names(await results("?q=rocket")), ["gamer_jordan"]);
      assert.deepEqual(names(await results("?q=diamond")), ["gamer_jordan"]);
      assert.deepEqual(names(await results("?q=omen")), ["gamer_jordan"]);
      assert.deepEqual(names(await results("?q=psych")), ["gamer_riley"]);
      assert.deepEqual(names(await results("?q=riley")), ["gamer_riley"]);
      assert.deepEqual(names(await results("?q=mobile")), ["gamer_riley"]);
      // Search and filters work together
      assert.deepEqual(names(await results("?q=minecraft&platform=Xbox")), ["gamer_sam"]);
      // % and _ are matched literally, not as wildcards
      assert.deepEqual(names(await results("?q=%25")), []);
      // As a wildcard, "ho_low" would match "Hollow"
      assert.deepEqual(names(await results("?q=ho_low")), []);
      assert.deepEqual(names(await results("?q=hollow_k")), ["gamer_casey"]);
    });

    await t.test("pages through results without repeats", async () => {
      const seen: string[] = [];
      for (let page = 1; page <= 4; page++) {
        const { matches, hasMore } = await findGamingPartners(db, viewer.user.id, {
          myGames: ["VALORANT", "Minecraft"],
          myPlatforms: ["PC", "Nintendo Switch"],
          page,
          pageSize: 1,
        });
        seen.push(...matches.map((m) => m.username));
        assert.equal(hasMore, page < 4, `page ${page}`);
      }
      assert.deepEqual(seen, ["gamer_jordan", "gamer_sam", "gamer_riley", "gamer_casey"]);
      const later = await results("?page=2");
      assert.deepEqual(names(later), []);
      assert.equal(later.page, 2);
      assert.equal((await results("?page=-1")).page, 1);
    });

    await t.test("shows uploaded photos only while a student can be found", async () => {
      const byName = Object.fromEntries(
        (await results()).results.map((m: { username: string }) => [m.username, m]),
      );
      const photoUrl = `/finder/gaming/${jordan.user.id}/photo`;
      assert.equal(byName.gamer_jordan.photo, photoUrl);
      assert.equal(byName.gamer_sam.photo, null); // external URLs are never shown
      assert.equal(byName.gamer_riley.photo, null);

      const photo = await get(photoUrl);
      assert.equal(photo.status, 200);
      assert.equal(photo.headers.get("content-type"), "image/webp");
      assert.equal(photo.headers.get("cache-control"), "private, no-store");
      assert.equal(await photo.text(), "photo of gamer_jordan");

      for (const id of [
        paused.user.id, // has a photo, but gaming partners is turned off
        sam.user.id,
        riley.user.id,
        noGaming.user.id,
        "abc",
        "0",
        "99999999999",
      ])
        assert.equal((await get(`/finder/gaming/${id}/photo`)).status, 404, String(id));

      // A gamer's photo isn't served through the study finder, and vice versa
      assert.equal((await get(`/finder/study/${jordan.user.id}/photo`)).status, 404);
    });

    await t.test("the page shows real students instead of sample data", async () => {
      const res = await get("/finder/gaming", viewer.cookie, false);
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.match(html, /gamer_jordan/);
      assert.match(html, /2 games in common/);
      assert.match(html, /Also on Nintendo Switch/);
      assert.match(html, /Diamond 2/);
      assert.match(html, /Unranked/);
      assert.doesNotMatch(html, /Jordan Ellis/);
      // The viewer's own games are quick filters, and every platform is
      assert.match(html, /href="\/finder\/gaming\?game=VALORANT"/);
      assert.match(html, /href="\/finder\/gaming\?platform=Nintendo\+Switch"/);
      assert.doesNotMatch(html, /can(?:&#x27;|')t find you here yet/);

      const newcomer = await (await get("/finder/gaming", noGaming.cookie, false)).text();
      assert.match(newcomer, /can(?:&#x27;|')t find you here yet/);
      assert.match(newcomer, /href="\/profile\/gaming"/);

      const empty = await (
        await get("/finder/gaming?q=nobody-matches-this", viewer.cookie, false)
      ).text();
      assert.match(empty, /No gaming partners found/);
    });

    await t.test("removing a gaming profile takes the student off the finder", async () => {
      const res = await fetch(`${base}/profile/gaming`, {
        method: "DELETE",
        headers: { accept: "application/json", cookie: jordan.cookie },
      });
      assert.equal(res.status, 200);
      assert.deepEqual(names(await results()), [
        "gamer_sam",
        "gamer_riley",
        "gamer_casey",
      ]);
      assert.equal((await get(`/finder/gaming/${jordan.user.id}/photo`)).status, 404);
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
