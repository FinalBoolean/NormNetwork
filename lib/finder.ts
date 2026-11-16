import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { splitList } from "../src/companions.js";
import {
  FINDER_LIMIT,
  type FinderCandidate,
  type FinderData,
} from "../src/finder.js";
import { ownProfile, relationships } from "./discovery.js";
import { presentProfile, type ProfileRecord } from "./profile-privacy.js";

type Db = Kysely<Database>;

function inCommon(theirs: string[], mine: string[]) {
  const own = new Set(mine.map((item) => item.toLowerCase()));
  return theirs.filter((item) => own.has(item.toLowerCase()));
}

/**
 * Students who turned on Friends in their profile and whose profiles the
 * viewer may see. Private profiles are skipped, and age, gender, and bio
 * follow each student's privacy settings. Friends and students with a
 * pending request are left out, since they already appear on the Friends page.
 */
export async function findCandidates(
  db: Db,
  viewerUserId: number,
): Promise<FinderData> {
  const me = await ownProfile(db, viewerUserId);
  const excluded = new Set<number>();
  if (me) {
    const { friends, requests } = await relationships(db, me.id);
    for (const row of friends) excluded.add(row.profile_a_id).add(row.profile_b_id);
    for (const row of requests) excluded.add(row.sender_id).add(row.receiver_id);
  }

  let query = db
    .selectFrom("profiles")
    .innerJoin("users", "users.id", "profiles.user_id")
    .innerJoin("companion_types", "companion_types.user_id", "profiles.user_id")
    .select([
      "profiles.id",
      "profiles.user_id",
      "profiles.profile_picture",
      "profiles.bio",
      "profiles.age",
      "profiles.class",
      "profiles.gender",
      "profiles.major",
      "profiles.visibility",
      "profiles.show_age",
      "profiles.show_gender",
      "profiles.show_bio",
      "users.username",
    ])
    .where("companion_types.type", "=", "friends")
    .where("profiles.user_id", "!=", viewerUserId)
    .where("profiles.visibility", "!=", "private");
  if (excluded.size) query = query.where("profiles.id", "not in", [...excluded]);
  // Fetch extra rows in case some profiles turn out not to be visible.
  const rows: ProfileRecord[] = await query
    .orderBy("profiles.id", "desc")
    .limit(FINDER_LIMIT * 2)
    .execute();

  const result = (candidates: FinderCandidate[]): FinderData => ({
    signedIn: true,
    hasProfile: !!me,
    // Most in common first; the sort is stable, so ties stay newest first.
    candidates: candidates
      .sort((a, b) => b.shared.length - a.shared.length)
      .slice(0, FINDER_LIMIT),
  });
  if (!rows.length) return result([]);

  const [entries, mine] = await Promise.all([
    db.selectFrom("friend_finder").selectAll()
      .where("user_id", "in", rows.map((row) => row.user_id)).execute(),
    db.selectFrom("friend_finder").select("interest")
      .where("user_id", "=", viewerUserId).executeTakeFirst(),
  ]);
  const byUser = new Map(entries.map((entry) => [entry.user_id, entry]));
  const myInterests = splitList(mine?.interest);

  const noFriends = new Set<number>();
  const candidates: FinderCandidate[] = [];
  for (const row of rows) {
    const person = presentProfile(row, {
      userId: viewerUserId,
      friendProfileIds: noFriends,
    });
    if (!person) continue;
    const interests = splitList(byUser.get(row.user_id)?.interest);
    candidates.push({
      kind: "friends",
      profileId: row.id,
      username: person.username,
      class: person.class,
      major: person.major,
      profilePicture: person.profile_picture,
      age: person.age,
      bio: person.bio,
      hidden: person.hidden,
      interests,
      shared: inCommon(interests, myInterests),
    });
  }
  return result(candidates);
}
