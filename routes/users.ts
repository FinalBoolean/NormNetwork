import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { PHOTO_URL } from "../lib/profile-photo.js";
import {
  findProfileRecord,
  friendProfileIds,
  presentProfile,
} from "../lib/profile-privacy.js";
import { USERNAME_PATTERN } from "../lib/validation.js";

// Another student's profile. Visibility is decided in lib/profile-privacy.ts.
export const usersRouter = Router();
usersRouter.use(requireAuth);

const wantsJson = (req: Request) =>
  req.is("application/json") || req.accepts(["html", "json"]) === "json";

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

function missing(req: Request, res: Response): void {
  if (wantsJson(req)) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  throw new HttpError(404, "Profile not found");
}

async function visibleProfile(req: Request, res: Response) {
  const { db, userId } = context(req);
  const username = req.params.username;
  if (typeof username !== "string" || !USERNAME_PATTERN.test(username))
    return missing(req, res);
  const row = await findProfileRecord(db, username);
  if (!row) return missing(req, res);
  const person = presentProfile(row, {
    userId,
    friendProfileIds: await friendProfileIds(db, userId),
  });
  if (!person) return missing(req, res);
  return { db, row, person };
}

usersRouter.get("/:username/photo", async (req, res) => {
  const loaded = await visibleProfile(req, res);
  if (!loaded || res.headersSent) return;
  if (loaded.row.profile_picture !== PHOTO_URL)
    throw new HttpError(404, "Profile photo not found");
  const photo = await loaded.db
    .selectFrom("profile_photos")
    .select("image")
    .where("profile_id", "=", loaded.row.id)
    .executeTakeFirst();
  if (!photo) throw new HttpError(404, "Profile photo not found");
  res.set({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.type("image/webp").send(Buffer.from(photo.image));
});

usersRouter.get("/:username", async (req, res) => {
  const loaded = await visibleProfile(req, res);
  if (!loaded || res.headersSent) return;
  res.vary("Accept");
  res.set("Cache-Control", "private, no-store");
  if (wantsJson(req)) return res.json(loaded.person);
  if (loaded.row.user_id === req.user?.id) return res.redirect(302, "/profile");
  res.render("pages/user", {
    title: loaded.person.username,
    person: loaded.person,
  });
});
