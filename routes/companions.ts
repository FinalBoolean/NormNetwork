import { Router, type Request, type Response } from "express";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import type { PageProps } from "../src/App.js";
import type { Profile } from "../src/profile.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { companionTypesFor } from "../lib/companions.js";
import {
  validateCompanionTypes,
  validateGamingProfile,
  validateStudyProfile,
} from "../lib/companion-validation.js";
import type { CompanionType } from "../src/companions.js";
import { context, wantsJson } from "./profiles.js";

// What students are looking for, and the profile for each kind of companion.
// Mounted at /profile. Tables: companion_types, study_finder, gaming_finder
export const companionsRouter = Router();
companionsRouter.use(requireAuth);

type Db = Kysely<Database>;
type Errors = Record<string, string>;

const NEEDS_PROFILE = "Save your main profile first.";

const findProfile = (db: Db, userId: number) =>
  db
    .selectFrom("profiles")
    .selectAll()
    .where("user_id", "=", userId)
    .executeTakeFirst();

/**
 * Loads and locks the main profile for the rest of a transaction, so an age
 * check can't race with a profile edit that changes the age.
 */
async function lockProfile(trx: Db, userId: number) {
  const profile = await trx
    .selectFrom("profiles")
    .selectAll()
    .where("user_id", "=", userId)
    .forUpdate()
    .executeTakeFirst();
  if (!profile) throw new HttpError(409, NEEDS_PROFILE);
  return profile;
}

/** Copies submitted form fields back into the page so nothing is lost on errors. */
function submitted(body: unknown, fields: readonly string[]) {
  const values: Record<string, string> = {};
  if (!body || typeof body !== "object") return values;
  for (const field of fields) {
    const value = (body as Record<string, unknown>)[field];
    if (typeof value === "string" || typeof value === "number")
      values[field] = String(value);
    else if (Array.isArray(value))
      values[field] = value.filter((v) => typeof v === "string").join(", ");
  }
  return values;
}

function noCache(res: Response) {
  res.vary("Accept");
  res.set("Cache-Control", "no-store");
}

// ---------- Companion types ----------

function renderCompanions(
  res: Response,
  props: Pick<PageProps, "profile" | "companionTypes" | "values" | "errors" | "notice">,
) {
  res.render("pages/companions", {
    title: "What you're looking for",
    ...props,
  });
}

companionsRouter.get("/companions", async (req, res) => {
  const { db, userId } = context(req);
  noCache(res);
  const profile = await findProfile(db, userId);
  if (!profile) {
    if (wantsJson(req))
      return res.status(404).json({ error: "Profile not found" });
    return res.redirect("/profile");
  }
  const companionTypes = await companionTypesFor(db, userId);
  if (wantsJson(req)) return res.json({ companion_types: companionTypes });
  renderCompanions(res, {
    profile,
    companionTypes,
    notice:
      req.query.welcome === "1"
        ? "Profile saved. Next, choose what you're looking for."
        : undefined,
  });
});

async function saveCompanions(req: Request, res: Response) {
  const { db, userId } = context(req);
  const result = await db.transaction().execute(async (trx) => {
    const profile = await lockProfile(trx, userId);
    const { values, errors } = validateCompanionTypes(req.body, profile.age);
    if (Object.keys(errors).length) return { profile, errors };
    await trx
      .deleteFrom("companion_types")
      .where("user_id", "=", userId)
      .execute();
    await trx
      .insertInto("companion_types")
      .values(values.map((type) => ({ user_id: userId, type })))
      .execute();
    return { profile, companionTypes: values };
  });
  if ("errors" in result) {
    if (wantsJson(req)) return res.status(400).json({ errors: result.errors });
    res.status(400);
    return renderCompanions(res, {
      profile: result.profile,
      values: submitted(req.body, ["companion_types"]),
      errors: result.errors,
    });
  }
  if (wantsJson(req))
    return res.json({ companion_types: result.companionTypes });
  res.redirect(303, "/profile?saved=companions");
}
companionsRouter.put("/companions", saveCompanions);
companionsRouter.post("/companions", saveCompanions);

// ---------- Partner profiles ----------

/**
 * Each of these profiles has the same routes, at /profile/<type>:
 *   GET     the profile (JSON) or its form (HTML)
 *   PUT     create or replace it (JSON); HTML forms POST to the same path
 *   DELETE  remove it (JSON); HTML forms POST to /profile/<type>/delete
 * Saving a profile also turns its companion type on; removing it turns it off.
 */
interface PartnerProfile<Row, Values> {
  type: Exclude<CompanionType, "friends">;
  page: string;
  title: string;
  /** Prop name the React page reads the saved row from. */
  prop: "studyProfile" | "gamingProfile";
  fields: readonly string[];
  validate(body: unknown): { values: Values; errors: Errors };
  find(db: Db, userId: number): Promise<Row | undefined>;
  save(db: Db, userId: number, values: Values): Promise<Row>;
  remove(db: Db, userId: number): Promise<Row | undefined>;
}

function partnerProfileRoutes<Row, Values>(spec: PartnerProfile<Row, Values>) {
  const path = `/${spec.type}`;
  const notFound = `${spec.title} not found`;

  function render(
    res: Response,
    profile: Profile,
    row: Row | undefined,
    values?: Record<string, string>,
    errors?: Errors,
  ) {
    res.render(`pages/${spec.page}`, {
      title: spec.title,
      profile,
      [spec.prop]: row ?? null,
      values,
      errors,
    });
  }

  companionsRouter.get(path, async (req, res) => {
    const { db, userId } = context(req);
    noCache(res);
    const profile = await findProfile(db, userId);
    if (!profile) {
      if (wantsJson(req))
        return res.status(404).json({ error: "Profile not found" });
      return res.redirect("/profile");
    }
    const row = await spec.find(db, userId);
    if (wantsJson(req))
      return row ? res.json(row) : res.status(404).json({ error: notFound });
    render(res, profile, row);
  });

  async function save(req: Request, res: Response) {
    const { db, userId } = context(req);
    const { values, errors } = spec.validate(req.body);
    const result = await db.transaction().execute(async (trx) => {
      const profile = await lockProfile(trx, userId);
      if (Object.keys(errors).length) return { profile, errors };
      const row = await spec.save(trx, userId, values);
      await trx
        .insertInto("companion_types")
        .values({ user_id: userId, type: spec.type })
        .onConflict((oc) => oc.columns(["user_id", "type"]).doNothing())
        .execute();
      return { profile, row };
    });
    if ("errors" in result) {
      if (wantsJson(req))
        return res.status(400).json({ errors: result.errors });
      res.status(400);
      return render(
        res,
        result.profile,
        await spec.find(db, userId),
        submitted(req.body, spec.fields),
        result.errors,
      );
    }
    if (wantsJson(req)) return res.json(result.row);
    res.redirect(303, `/profile?saved=${spec.type}`);
  }
  companionsRouter.put(path, save);
  companionsRouter.post(path, save);

  async function remove(req: Request, res: Response) {
    const { db, userId } = context(req);
    const row = await db.transaction().execute(async (trx) => {
      const removed = await spec.remove(trx, userId);
      if (removed)
        await trx
          .deleteFrom("companion_types")
          .where("user_id", "=", userId)
          .where("type", "=", spec.type)
          .execute();
      return removed;
    });
    if (wantsJson(req))
      return row
        ? res.json({ message: `${spec.title} deleted`, [spec.prop]: row })
        : res.status(404).json({ error: notFound });
    res.redirect(303, `/profile?removed=${spec.type}`);
  }
  companionsRouter.delete(path, remove);
  companionsRouter.post(`${path}/delete`, remove);
}

partnerProfileRoutes({
  type: "study",
  page: "study_profile",
  title: "Study partner profile",
  prop: "studyProfile",
  fields: ["subject", "course", "additional_info", "availability", "meeting_place"],
  validate: validateStudyProfile,
  find: (db, userId) =>
    db
      .selectFrom("study_finder")
      .selectAll()
      .where("user_id", "=", userId)
      .executeTakeFirst(),
  save: (db, userId, values) =>
    db
      .insertInto("study_finder")
      .values({ ...values, user_id: userId })
      .onConflict((oc) => oc.column("user_id").doUpdateSet(values))
      .returningAll()
      .executeTakeFirstOrThrow(),
  remove: (db, userId) =>
    db
      .deleteFrom("study_finder")
      .where("user_id", "=", userId)
      .returningAll()
      .executeTakeFirst(),
});

partnerProfileRoutes({
  type: "gaming",
  page: "gaming_profile",
  title: "Gaming partner profile",
  prop: "gamingProfile",
  fields: [
    "games",
    "platforms",
    "rank",
    "main_character",
    "main_role",
    "play_style",
    "voice_chat",
    "availability",
  ],
  validate: validateGamingProfile,
  find: (db, userId) =>
    db
      .selectFrom("gaming_finder")
      .selectAll()
      .where("user_id", "=", userId)
      .executeTakeFirst(),
  save: (db, userId, values) =>
    db
      .insertInto("gaming_finder")
      .values({ ...values, user_id: userId })
      .onConflict((oc) => oc.column("user_id").doUpdateSet(values))
      .returningAll()
      .executeTakeFirstOrThrow(),
  remove: (db, userId) =>
    db
      .deleteFrom("gaming_finder")
      .where("user_id", "=", userId)
      .returningAll()
      .executeTakeFirst(),
});
