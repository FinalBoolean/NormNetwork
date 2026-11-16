import { Router, type Request } from "express";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { normalizeCourseCode } from "../lib/companion-validation.js";
import {
  findStudyBuddies,
  studyBuddyPhoto,
  studyFinderViewer,
} from "../lib/study-finder.js";
import { STUDY_SEARCH_MAX, type StudyFinderData } from "../src/studyFinder.js";
import { context, wantsJson } from "./profiles.js";

// Finders: match students by interests, courses, and games.
// Tables: friend_finder, study_finder, gaming_finder
export const finderRouter = Router();

finderRouter.get("/", (req, res) => res.redirect("/finder/friends"));

finderRouter.get("/friends", (_req, res) => {
  res.render("pages/friend_finder", {
    title: "Friend Finder",
    description: "Meet Niners who share your interests.",
  });
});

// ---------- Study Buddy Finder ----------

const MAX_PAGE = 1000;
// PostgreSQL integer columns can't hold larger IDs.
const MAX_ID = 2_147_483_647;

/** Reads a single text value from the query string (ignores ?q=a&q=b arrays). */
const queryText = (req: Request, name: string) => {
  const value = req.query[name];
  return typeof value === "string" ? value.trim() : "";
};

function studyFilters(req: Request) {
  const q = queryText(req, "q").slice(0, STUDY_SEARCH_MAX);
  const rawCourse = queryText(req, "course");
  const course = rawCourse ? normalizeCourseCode(rawCourse) : "";
  const pageText = queryText(req, "page");
  const page = /^\d{1,4}$/.test(pageText)
    ? Math.min(Math.max(Number(pageText), 1), MAX_PAGE)
    : 1;
  return { q, rawCourse, course, page };
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
  res.vary("Accept");
  res.set("Cache-Control", "no-store");

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
finderRouter.get("/study/:userId/photo", requireAuth, async (req, res) => {
  const { db } = context(req);
  const id = String(req.params.userId);
  if (!/^\d{1,10}$/.test(id) || Number(id) < 1 || Number(id) > MAX_ID)
    throw new HttpError(404, "Photo not found");
  const photo = await studyBuddyPhoto(db, Number(id));
  if (!photo) throw new HttpError(404, "Photo not found");
  res.set({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.type("image/webp").send(Buffer.from(photo.image));
});

// ---------- Gaming Partner Finder ----------

finderRouter.get("/gaming", (_req, res) => {
  res.render("pages/gaming_finder", {
    title: "Gaming Finder",
    description: "Find teammates by game, rank, and role.",
  });
});
