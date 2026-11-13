import { Router, type Request, type Response } from "express";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import type { PageProps } from "../src/App.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { companionTypesFor } from "../lib/companions.js";
import { validateCompanionTypes } from "../lib/companion-validation.js";
import { context, wantsJson } from "./profiles.js";

// What students are looking for, and the profile for each kind of companion.
// Mounted at /profile. Tables: companion_types
export const companionsRouter = Router();
companionsRouter.use(requireAuth);

type Db = Kysely<Database>;

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
