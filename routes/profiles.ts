import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { validateProfile } from "../lib/profile-validation.js";
import type { Profile, ProfileInput } from "../src/profile.js";

// Keep the contributor's authenticated profile CRUD, using the app's shared DB.
export const profilesRouter = Router();
profilesRouter.use(requireAuth);

function context(req: Request) {
  if (!req.user) throw new HttpError(401, "You need to log in first.");
  const db = req.app.locals.db;
  if (!db)
    throw new HttpError(
      503,
      "Profiles are unavailable: the database isn't connected.",
    );
  return { db, userId: req.user.id };
}

const wantsJson = (req: Request) =>
  req.is("application/json") || req.accepts(["html", "json"]) === "json";

function renderProfile(
  res: Response,
  profile: Profile | null,
  editingProfile = false,
  values?: Record<string, string>,
  errors?: Record<string, string>,
  notice?: string,
) {
  res.render("pages/profile", {
    title: "Your profile",
    profile,
    editingProfile,
    values,
    errors,
    notice,
  });
}

function invalid(
  req: Request,
  res: Response,
  errors: Record<string, string>,
  profile: Profile | null,
  status = 400,
) {
  if (wantsJson(req)) return res.status(status).json({ errors });
  const values: Record<string, string> = {};
  for (const key of [
    "age",
    "class",
    "gender",
    "major",
    "bio",
    "profile_picture",
  ]) {
    const value = req.body?.[key];
    if (typeof value === "string" || typeof value === "number")
      values[key] = String(value);
  }
  res.status(status);
  renderProfile(res, profile, true, values, errors);
}

profilesRouter.get("/", async (req, res) => {
  const { db, userId } = context(req);
  const profile = await db
    .selectFrom("profiles")
    .selectAll()
    .where("user_id", "=", userId)
    .executeTakeFirst();
  res.vary("Accept");
  res.set("Cache-Control", "no-store");
  if (wantsJson(req))
    return profile
      ? res.json(profile)
      : res.status(404).json({ error: "Profile not found" });
  renderProfile(
    res,
    profile ?? null,
    req.query.edit === "1",
    undefined,
    undefined,
    req.query.saved === "1" ? "Profile saved." : undefined,
  );
});

profilesRouter.post("/", async (req, res) => {
  const { db, userId } = context(req);
  const { values, errors } = validateProfile(req.body);
  if (Object.keys(errors).length) return invalid(req, res, errors, null);
  // The unique user_id constraint also handles simultaneous create requests.
  const profile = await db
    .insertInto("profiles")
    .values({ ...(values as ProfileInput), user_id: userId })
    .onConflict((oc) => oc.column("user_id").doNothing())
    .returningAll()
    .executeTakeFirst();
  if (!profile)
    return invalid(
      req,
      res,
      { form: "Profile already exists. Open your profile to edit it." },
      null,
      409,
    );
  if (wantsJson(req)) return res.status(201).json(profile);
  res.redirect(303, "/profile?saved=1");
});

// HTML forms use POST /edit; API clients keep the original PATCH /profile.
async function updateProfile(req: Request, res: Response) {
  const { db, userId } = context(req);
  const existing = await db
    .selectFrom("profiles")
    .selectAll()
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!existing) throw new HttpError(404, "Profile not found");
  const { values, errors } = validateProfile(req.body, true);
  if (Object.keys(errors).length) return invalid(req, res, errors, existing);
  const profile = await db
    .updateTable("profiles")
    .set(values)
    .where("user_id", "=", userId)
    .returningAll()
    .executeTakeFirst();
  if (!profile) throw new HttpError(404, "Profile not found");
  if (wantsJson(req)) return res.json(profile);
  res.redirect(303, "/profile?saved=1");
}
profilesRouter.patch("/", updateProfile);
profilesRouter.post("/edit", updateProfile);

profilesRouter.delete("/", async (req, res) => {
  const { db, userId } = context(req);
  const profile = await db
    .deleteFrom("profiles")
    .where("user_id", "=", userId)
    .returningAll()
    .executeTakeFirst();
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  return res.json({ message: "Profile deleted", profile });
});
