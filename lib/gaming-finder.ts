import { sql, type Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { splitList } from "../src/companions.js";
import {
  GAMING_FINDER_PAGE_SIZE,
  type GamingMatch,
} from "../src/gaming-finder.js";
import { LIST_SEPARATOR, likePattern } from "./finder-query.js";
import { PHOTO_URL } from "./profile-photo.js";

// Gaming Partner Finder queries. Tables: gaming_finder, profiles, users,
// companion_types, profile_photos

type Db = Kysely<Database>;

/** URL the finder serves a gaming partner's uploaded photo from. */
export const gamingPhotoUrl = (userId: number) =>
  `/finder/gaming/${userId}/photo`;

/**
 * Students who can be found on the Gaming Partner Finder: they have a main
 * profile and a gaming partner profile, and Gaming partners is turned on.
 * A paused gaming profile (turned off on /profile/companions) stays hidden.
 */
function discoverableGamers(db: Db) {
  return db
    .selectFrom("gaming_finder as gf")
    .innerJoin("profiles as p", "p.user_id", "gf.user_id")
    .innerJoin("users as u", "u.id", "gf.user_id")
    .innerJoin("companion_types as ct", (join) =>
      join.onRef("ct.user_id", "=", "gf.user_id").on("ct.type", "=", "gaming"),
    );
}

/** True when the student plays this game. Game names match in any letter case. */
const playsGame = (game: string) =>
  sql<boolean>`lower(${game}) = any(string_to_array(lower(gf.games), ${LIST_SEPARATOR}))`;

/** True when the student plays on this platform (one of PLATFORMS). */
const playsOn = (platform: string) =>
  sql<boolean>`${platform} = any(string_to_array(gf.platforms, ${LIST_SEPARATOR}))`;

/** How many items two stored lists have in common, ignoring letter case. */
const overlap = (column: "gf.games" | "gf.platforms", mine: string[]) =>
  sql<number>`cardinality(array(
    select unnest(string_to_array(lower(${sql.ref(column)}), ${LIST_SEPARATOR}))
    intersect
    select unnest(string_to_array(lower(${mine.join(LIST_SEPARATOR)}::text), ${LIST_SEPARATOR}))
  ))`;

/** The looking student's own games and platforms, and whether others can find them. */
export async function gamingFinderViewer(db: Db, userId: number) {
  const [mine, gamingOn] = await Promise.all([
    db
      .selectFrom("gaming_finder")
      .select(["games", "platforms"])
      .where("user_id", "=", userId)
      .executeTakeFirst(),
    db
      .selectFrom("companion_types")
      .select("type")
      .where("user_id", "=", userId)
      .where("type", "=", "gaming")
      .executeTakeFirst(),
  ]);
  return {
    myGames: splitList(mine?.games),
    myPlatforms: splitList(mine?.platforms),
    discoverable: Boolean(mine && gamingOn),
  };
}

/**
 * Finds gaming partners for a student, never including the student themselves.
 *
 * - `game`: only students who play this game (any letter case)
 * - `platform`: only students on this platform (one of PLATFORMS)
 * - `q`: search games, platforms, rank, role, main character, play style,
 *   when they play, major, and username
 *
 * Students who share the most games with the looking student come first, then
 * the most platforms, then alphabetically by username.
 */
export async function findGamingPartners(
  db: Db,
  userId: number,
  {
    myGames = [],
    myPlatforms = [],
    game = "",
    platform = "",
    q = "",
    page = 1,
    pageSize = GAMING_FINDER_PAGE_SIZE,
  }: {
    myGames?: string[];
    myPlatforms?: string[];
    game?: string;
    platform?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ matches: GamingMatch[]; hasMore: boolean }> {
  let query = discoverableGamers(db)
    .leftJoin("profile_photos as ph", "ph.profile_id", "p.id")
    .select([
      "gf.user_id",
      "u.username",
      "p.class",
      "p.major",
      "p.bio",
      "p.profile_picture",
      "ph.profile_id as photo_profile_id",
      "gf.games",
      "gf.platforms",
      "gf.rank",
      "gf.main_role",
      "gf.main_character",
      "gf.play_style",
      "gf.voice_chat",
      "gf.availability",
    ])
    .where("gf.user_id", "!=", userId);

  if (game.trim()) query = query.where(playsGame(game.trim()));
  if (platform) query = query.where(playsOn(platform));

  const text = q.trim();
  if (text) {
    const pattern = likePattern(text);
    query = query.where((eb) =>
      eb.or([
        eb("gf.games", "ilike", pattern),
        eb("gf.platforms", "ilike", pattern),
        eb("gf.rank", "ilike", pattern),
        eb("gf.main_role", "ilike", pattern),
        eb("gf.main_character", "ilike", pattern),
        eb("gf.play_style", "ilike", pattern),
        eb("gf.availability", "ilike", pattern),
        eb("p.major", "ilike", pattern),
        eb("u.username", "ilike", pattern),
      ]),
    );
  }

  const rows = await query
    .orderBy(overlap("gf.games", myGames), "desc")
    .orderBy(overlap("gf.platforms", myPlatforms), "desc")
    .orderBy(sql`lower(u.username)`)
    .limit(pageSize + 1)
    .offset((Math.max(page, 1) - 1) * pageSize)
    .execute();

  const myGameSet = new Set(myGames.map((name) => name.toLowerCase()));
  const myPlatformSet = new Set(myPlatforms);
  const matches = rows.slice(0, pageSize).map((row): GamingMatch => {
    const games = splitList(row.games);
    const platforms = splitList(row.platforms);
    return {
      user_id: row.user_id,
      username: row.username,
      class: row.class,
      major: row.major,
      bio: row.bio,
      games,
      shared_games: games.filter((name) => myGameSet.has(name.toLowerCase())),
      platforms,
      shared_platforms: platforms.filter((name) => myPlatformSet.has(name)),
      rank: row.rank,
      main_role: row.main_role,
      main_character: row.main_character,
      play_style: row.play_style,
      voice_chat: row.voice_chat,
      availability: row.availability,
      // Only photos uploaded to Norm's Network; see lib/study-finder.ts.
      photo:
        row.profile_picture === PHOTO_URL && row.photo_profile_id !== null
          ? gamingPhotoUrl(row.user_id)
          : null,
    };
  });
  return { matches, hasMore: rows.length > pageSize };
}

/** A gaming partner's uploaded photo, only while they can be found on the finder. */
export async function gamingPartnerPhoto(db: Db, userId: number) {
  return discoverableGamers(db)
    .innerJoin("profile_photos as ph", "ph.profile_id", "p.id")
    .select("ph.image")
    .where("gf.user_id", "=", userId)
    .where("p.profile_picture", "=", PHOTO_URL)
    .executeTakeFirst();
}
