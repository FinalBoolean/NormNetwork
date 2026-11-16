import { Router, type Request, type Response } from "express";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { normalizeCourseCode } from "../lib/companion-validation.js";
import {
  findStudyBuddies,
  studyBuddyPhoto,
  studyFinderViewer,
} from "../lib/study-finder.js";
import {
  findGamingPartners,
  gamingFinderViewer,
  gamingPartnerPhoto,
} from "../lib/gaming-finder.js";
import { STUDY_SEARCH_MAX, type StudyFinderData } from "../src/study-finder.js";
import {
  GAMING_SEARCH_MAX,
  type GamingFinderData,
} from "../src/gaming-finder.js";
import { GAME_NAME_MAX, PLATFORMS } from "../src/companions.js";
import { context, wantsJson } from "./profiles.js";
import { visibleProfiles } from "../lib/profile-privacy.js";

// Finders: match students by interests, courses, and games.
// Tables: friend_finder, study_finder, gaming_finder
export const finderRouter = Router();

finderRouter.get("/", (req, res) => res.redirect("/finder/friends"));

finderRouter.get("/friends", async (req, res) => {
  const db = req.app.locals.db;
  const [person] =
    req.user && db ? await visibleProfiles(db, req.user.id, 1) : [];
  if (req.user) res.set("Cache-Control", "private, no-store");
  res.render("pages/friend_finder", {
    title: "Friend Finder",
    description: "Meet Niners who share your interests.",
    person,
  });
});

// ---------- Shared by the finders ----------

const MAX_PAGE = 1000;
// PostgreSQL integer columns can't hold larger IDs.
const MAX_ID = 2_147_483_647;

/** Reads a single text value from the query string (ignores ?q=a&q=b arrays). */
const queryText = (req: Request, name: string) => {
  const value = req.query[name];
  return typeof value === "string" ? value.trim() : "";
};

/** ?page=, starting at 1. Anything that isn't a page number means page 1. */
function pageNumber(req: Request) {
  const pageText = queryText(req, "page");
  return /^\d{1,4}$/.test(pageText)
    ? Math.min(Math.max(Number(pageText), 1), MAX_PAGE)
    : 1;
}

/** Finder results are personal and change often: never cache them. */
function noCache(res: Response) {
  res.vary("Accept");
  res.set("Cache-Control", "no-store");
}

/**
 * GET /finder/<mode>/:userId/photo: a student's uploaded photo, served only
 * while `lookup` says they can be found on that finder. Otherwise 404.
 */
function photoRoute(
  mode: string,
  lookup: (
    db: Kysely<Database>,
    userId: number,
  ) => Promise<{ image: Buffer } | undefined>,
) {
  finderRouter.get(`/${mode}/:userId/photo`, requireAuth, async (req, res) => {
    const { db } = context(req);
    const id = String(req.params.userId);
    if (!/^\d{1,10}$/.test(id) || Number(id) < 1 || Number(id) > MAX_ID)
      throw new HttpError(404, "Photo not found");
    const photo = await lookup(db, Number(id));
    if (!photo) throw new HttpError(404, "Photo not found");
    res.set({
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.type("image/webp").send(Buffer.from(photo.image));
  });
}

// ---------- Study Buddy Finder ----------

function studyFilters(req: Request) {
  const q = queryText(req, "q").slice(0, STUDY_SEARCH_MAX);
  const rawCourse = queryText(req, "course");
  const course = rawCourse ? normalizeCourseCode(rawCourse) : "";
  return { q, rawCourse, course, page: pageNumber(req) };
}

/**
 * GET /finder/study: students to study with, from their study partner profiles.
 *   ?q=      search subject, courses, major, username, and what they need help with
 *   ?course= only students taking this course, e.g. ITSC 3155
 *   ?page=   page number, starting at 1
 * Send `Accept: application/json` for { results, page, has_more, q, course }.
 */
finderRouter.get("/study", requireAuth, async (req, res) => {
  const { db, userId } = context(req);
  noCache(res);

  const { q, rawCourse, course, page } = studyFilters(req);
  const viewer = await studyFinderViewer(db, userId);

  if (course === null) {
    const errors = {
      course: `"${rawCourse.slice(0, 20)}" isn't a course code. Use the format ITSC 3155.`,
    };
    if (wantsJson(req)) return res.status(400).json({ errors });
    res.status(400);
    return res.render("pages/study_finder", {
      title: "Study Buddy Finder",
      studyFinder: { ...viewer, matches: [], q, course: "", page: 1, hasMore: false },
      errors,
    });
  }

  const { matches, hasMore } = await findStudyBuddies(db, userId, {
    myCourses: viewer.myCourses,
    course,
    q,
    page,
  });

  if (wantsJson(req))
    return res.json({ results: matches, page, has_more: hasMore, q, course });

  const studyFinder: StudyFinderData = {
    ...viewer,
    matches,
    q,
    course,
    page,
    hasMore,
  };
  res.render("pages/study_finder", { title: "Study Buddy Finder", studyFinder });
});

/** A study buddy's uploaded photo. 404 unless they can be found on the finder. */
photoRoute("study", studyBuddyPhoto);

// ---------- Gaming Partner Finder ----------

function gamingFilters(req: Request) {
  const q = queryText(req, "q").slice(0, GAMING_SEARCH_MAX);
  const game = queryText(req, "game");
  const rawPlatform = queryText(req, "platform");
  const platform = rawPlatform
    ? (PLATFORMS.find((p) => p.toLowerCase() === rawPlatform.toLowerCase()) ??
      null)
    : "";
  const errors: Record<string, string> = {};
  if (game.length > GAME_NAME_MAX)
    errors.game = `Game names are at most ${GAME_NAME_MAX} characters.`;
  if (platform === null)
    errors.platform = `Choose a platform: ${PLATFORMS.join(", ")}.`;
  return { q, game, platform: platform ?? "", page: pageNumber(req), errors };
}

/**
 * GET /finder/gaming: students to play with, from their gaming partner profiles.
 *   ?q=        search games, platforms, rank, role, main character, play style,
 *              when they play, major, and username
 *   ?game=     only students who play this game (any letter case)
 *   ?platform= only students on this platform, e.g. PC
 *   ?page=     page number, starting at 1
 * Send `Accept: application/json` for { results, page, has_more, q, game, platform }.
 */
finderRouter.get("/gaming", requireAuth, async (req, res) => {
  const { db, userId } = context(req);
  noCache(res);

  const { q, game, platform, page, errors } = gamingFilters(req);
  const viewer = await gamingFinderViewer(db, userId);

  if (Object.keys(errors).length) {
    if (wantsJson(req)) return res.status(400).json({ errors });
    res.status(400);
    const gamingFinder: GamingFinderData = {
      ...viewer,
      matches: [],
      q,
      game: errors.game ? "" : game,
      platform,
      page: 1,
      hasMore: false,
    };
    return res.render("pages/gaming_finder", {
      title: "Gaming Partner Finder",
      gamingFinder,
      errors,
    });
  }

  const { matches, hasMore } = await findGamingPartners(db, userId, {
    myGames: viewer.myGames,
    myPlatforms: viewer.myPlatforms,
    game,
    platform,
    q,
    page,
  });

  if (wantsJson(req))
    return res.json({
      results: matches,
      page,
      has_more: hasMore,
      q,
      game,
      platform,
    });

  const gamingFinder: GamingFinderData = {
    ...viewer,
    matches,
    q,
    game,
    platform,
    page,
    hasMore,
  };
  res.render("pages/gaming_finder", { title: "Gaming Partner Finder", gamingFinder });
});

/** A gaming partner's uploaded photo. 404 unless they can be found on the finder. */
photoRoute("gaming", gamingPartnerPhoto);
