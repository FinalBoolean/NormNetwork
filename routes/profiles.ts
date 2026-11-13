import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { validateProfile } from "../lib/profile-validation.js";
import type { Profile, ProfileInput } from "../src/profile.js";
import { MIN_DATING_AGE } from "../src/companions.js";
import { clearDating, companionData } from "../lib/companions.js";
import {
  PHOTO_URL,
  processPhoto,
  receivePhoto,
  uploadError,
} from "../lib/profile-photo.js";

// Keep the contributor's authenticated profile CRUD, using the app's shared DB.
export const profilesRouter = Router();
profilesRouter.use(requireAuth);

export function context(req: Request) {
  if (!req.user) throw new HttpError(401, "You need to log in first.");
  const db = req.app.locals.db;
  if (!db)
    throw new HttpError(
      503,
      "Profiles are unavailable: the database isn't connected.",
    );
  return { db, userId: req.user.id };
}

export const wantsJson = (req: Request) =>
  req.is("application/json") || req.accepts(["html", "json"]) === "json";

function renderProfile(
  res: Response,
  profile: Profile | null,
  editingProfile = false,
  values?: Record<string, string>,
  errors?: Record<string, string>,
  notice?: string,
  companions?: Awaited<ReturnType<typeof companionData>>,
) {
  res.render("pages/profile", {
    title: "Your profile",
    profile,
    editingProfile,
    values,
    errors,
    notice,
    ...companions,
  });
}

// ?saved=... and ?removed=... after a redirect
const NOTICES: Record<string, Record<string, string>> = {
  saved: {
    "1": "Profile saved.",
    companions: "Saved what you're looking for.",
    study: "Study partner profile saved.",
  },
  removed: {
    study: "Study partner profile removed.",
  },
};

function noticeFor(query: Request["query"]) {
  for (const [param, messages] of Object.entries(NOTICES)) {
    const key = query[param];
    if (typeof key === "string" && Object.hasOwn(messages, key))
      return messages[key];
  }
  return undefined;
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
  const editing = !profile || req.query.edit === "1";
  renderProfile(
    res,
    profile ?? null,
    req.query.edit === "1",
    undefined,
    undefined,
    noticeFor(req.query),
    editing ? undefined : await companionData(db, userId),
  );
});

profilesRouter.get("/photo", async (req, res) => {
  const { db, userId } = context(req);
  const photo = await db
    .selectFrom("profile_photos")
    .innerJoin("profiles", "profiles.id", "profile_photos.profile_id")
    .select("profile_photos.image")
    .where("profiles.user_id", "=", userId)
    .where("profiles.profile_picture", "=", PHOTO_URL)
    .executeTakeFirst();
  if (!photo) throw new HttpError(404, "Profile photo not found");
  res.set({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.type("image/webp").send(Buffer.from(photo.image));
});

profilesRouter.post("/photo", async (req, res) => {
  const { db, userId } = context(req);
  const existing = await db
    .selectFrom("profiles")
    .selectAll()
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!existing)
    throw new HttpError(409, "Save your profile before uploading a photo.");
  let image: Buffer;
  try {
    await new Promise<void>((resolve, reject) =>
      receivePhoto(req, res, (error) =>
        error ? reject(uploadError(error)) : resolve(),
      ),
    );
    if (!req.file) throw new HttpError(400, "Choose a photo to upload.");
    image = await processPhoto(req.file.buffer);
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    if (wantsJson(req))
      return res
        .status(error.status)
        .json({ errors: { photo: error.message } });
    res.status(error.status);
    return renderProfile(res, existing, false, undefined, {
      photo: error.message,
    });
  }
  await db.transaction().execute(async (trx) => {
    // Lock the profile so concurrent replacements/deletions remain atomic.
    const profile = await trx
      .selectFrom("profiles")
      .select("id")
      .where("user_id", "=", userId)
      .forUpdate()
      .executeTakeFirst();
    if (!profile) throw new HttpError(404, "Profile not found");
    await trx
      .insertInto("profile_photos")
      .values({ profile_id: profile.id, image })
      .onConflict((oc) => oc.column("profile_id").doUpdateSet({ image }))
      .execute();
    await trx
      .updateTable("profiles")
      .set({ profile_picture: PHOTO_URL })
      .where("id", "=", profile.id)
      .execute();
  });
  if (wantsJson(req)) return res.json({ profile_picture: PHOTO_URL });
  res.redirect(303, "/profile?saved=1");
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
  // Next step for a new profile: choose what you're looking for.
  res.redirect(303, "/profile/companions?welcome=1");
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
  const profile = await db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable("profiles")
      .set(values)
      .where("user_id", "=", userId)
      .returningAll()
      .executeTakeFirst();
    // Dating is 18+ only, so an age below that turns it off.
    if (updated && updated.age < MIN_DATING_AGE)
      await clearDating(trx, userId);
    return updated;
  });
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
