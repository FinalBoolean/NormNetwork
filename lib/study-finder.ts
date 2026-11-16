import { sql, type Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { splitList } from "../src/companions.js";
import {
  STUDY_FINDER_PAGE_SIZE,
  type StudyMatch,
} from "../src/study-finder.js";
import { normalizeCourseCode } from "./companion-validation.js";
import { LIST_SEPARATOR as COURSE_SEPARATOR, likePattern } from "./finder-query.js";
import { PHOTO_URL } from "./profile-photo.js";

// Study Buddy Finder queries. Tables: study_finder, profiles, users,
// companion_types, profile_photos

type Db = Kysely<Database>;

/** URL the finder serves a study buddy's uploaded photo from. */
export const studyPhotoUrl = (userId: number) => `/finder/study/${userId}/photo`;

/**
 * Students who can be found on the Study Buddy Finder: they have a main
 * profile and a study partner profile, and Study partners is turned on.
 * A paused study profile (turned off on /profile/companions) stays hidden.
 */
function discoverableStudents(db: Db) {
  return db
    .selectFrom("study_finder as sf")
    .innerJoin("profiles as p", "p.user_id", "sf.user_id")
    .innerJoin("users as u", "u.id", "sf.user_id")
    .innerJoin("companion_types as ct", (join) =>
      join.onRef("ct.user_id", "=", "sf.user_id").on("ct.type", "=", "study"),
    );
}

/** True when the stored course list contains this exact course code. */
const hasCourse = (code: string) =>
  sql<boolean>`${code} = any(string_to_array(sf.course, ${COURSE_SEPARATOR}))`;

/** The looking student's own courses, and whether others can find them. */
export async function studyFinderViewer(db: Db, userId: number) {
  const [mine, studyOn] = await Promise.all([
    db
      .selectFrom("study_finder")
      .select("course")
      .where("user_id", "=", userId)
      .executeTakeFirst(),
    db
      .selectFrom("companion_types")
      .select("type")
      .where("user_id", "=", userId)
      .where("type", "=", "study")
      .executeTakeFirst(),
  ]);
  return {
    myCourses: splitList(mine?.course),
    discoverable: Boolean(mine && studyOn),
  };
}

/**
 * Finds study buddies for a student, never including the student themselves.
 *
 * - `course`: only students taking this course (any format, e.g. "itsc3155")
 * - `q`: search subject, courses, major, username, and what they need help with
 *
 * Students who share the most courses with `myCourses` come first, then
 * alphabetically by username. Returns one page plus whether there are more.
 */
export async function findStudyBuddies(
  db: Db,
  userId: number,
  {
    myCourses = [],
    course = "",
    q = "",
    page = 1,
    pageSize = STUDY_FINDER_PAGE_SIZE,
  }: {
    myCourses?: string[];
    course?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ matches: StudyMatch[]; hasMore: boolean }> {
  const mine = myCourses.join(COURSE_SEPARATOR);
  const sharedCount = sql<number>`cardinality(array(
    select unnest(string_to_array(sf.course, ${COURSE_SEPARATOR}))
    intersect
    select unnest(string_to_array(${mine}::text, ${COURSE_SEPARATOR}))
  ))`;

  let query = discoverableStudents(db)
    .leftJoin("profile_photos as ph", "ph.profile_id", "p.id")
    .select([
      "sf.user_id",
      "u.username",
      "p.class",
      "p.major",
      "p.bio",
      "p.profile_picture",
      "ph.profile_id as photo_profile_id",
      "sf.subject",
      "sf.course",
      "sf.additional_info",
      "sf.availability",
      "sf.meeting_place",
    ])
    .where("sf.user_id", "!=", userId);

  const courseCode = course ? normalizeCourseCode(course) : null;
  if (course && !courseCode) return { matches: [], hasMore: false };
  if (courseCode) query = query.where(hasCourse(courseCode));

  const text = q.trim();
  if (text) {
    const pattern = likePattern(text);
    const searchedCourse = normalizeCourseCode(text);
    query = query.where((eb) =>
      eb.or([
        eb("sf.subject", "ilike", pattern),
        eb("sf.course", "ilike", pattern),
        eb("sf.additional_info", "ilike", pattern),
        eb("p.major", "ilike", pattern),
        eb("u.username", "ilike", pattern),
        // "itsc3155" in the search box finds students taking ITSC 3155
        ...(searchedCourse ? [hasCourse(searchedCourse)] : []),
      ]),
    );
  }

  const rows = await query
    .orderBy(sharedCount, "desc")
    .orderBy(sql`lower(u.username)`)
    .limit(pageSize + 1)
    .offset((Math.max(page, 1) - 1) * pageSize)
    .execute();

  const mySet = new Set(myCourses);
  const matches = rows.slice(0, pageSize).map((row): StudyMatch => {
    const courses = splitList(row.course);
    return {
      user_id: row.user_id,
      username: row.username,
      class: row.class,
      major: row.major,
      bio: row.bio,
      subject: row.subject,
      courses,
      shared_courses: courses.filter((code) => mySet.has(code)),
      additional_info: row.additional_info,
      availability: row.availability,
      meeting_place: row.meeting_place,
      // Only photos uploaded to Norm's Network. External photo URLs are never
      // shown to other students, so viewing the finder can't contact other sites.
      photo:
        row.profile_picture === PHOTO_URL && row.photo_profile_id !== null
          ? studyPhotoUrl(row.user_id)
          : null,
    };
  });
  return { matches, hasMore: rows.length > pageSize };
}

/** A study buddy's uploaded photo, only while they can be found on the finder. */
export async function studyBuddyPhoto(db: Db, userId: number) {
  return discoverableStudents(db)
    .innerJoin("profile_photos as ph", "ph.profile_id", "p.id")
    .select("ph.image")
    .where("sf.user_id", "=", userId)
    .where("p.profile_picture", "=", PHOTO_URL)
    .executeTakeFirst();
}
