import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { PHOTO_URL } from "../lib/profile-photo.js";
import {
  discoveryContext, ownProfile, peopleQuery, positiveId, presentPerson, relationships, wantsJson,
} from "../lib/discovery.js";
import type { DiscoveryData } from "../src/discovery.js";

export const discoverRouter = Router();
discoverRouter.use(requireAuth);
discoverRouter.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  res.vary("Accept");
  next();
});

discoverRouter.get("/", async (req, res) => {
  const { db, userId } = discoveryContext(req);
  if (req.query.q !== undefined && typeof req.query.q !== "string")
    throw new HttpError(400, "Enter a search phrase.");
  const query = (req.query.q ?? "").trim();
  if (query.length > 100) throw new HttpError(400, "Search with at most 100 characters.");
  const page = req.query.page === undefined ? 1 : positiveId(req.query.page, "Page");
  const pageSize = 12;
  const profile = await ownProfile(db, userId);
  let selection = peopleQuery(db).where("profiles.user_id", "!=", userId);
  if (query) {
    // Search is literal: '%' and '_' in usernames must not become wildcards.
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    selection = selection.where((eb) => eb.or([
      eb("users.username", "ilike", pattern),
      eb("profiles.major", "ilike", pattern),
      eb("profiles.bio", "ilike", pattern),
    ]));
  }
  const rows = await selection.orderBy("profiles.id", "asc")
    .limit(pageSize + 1).offset((page - 1) * pageSize).execute();
  const relations = profile ? await relationships(db, profile.id) : undefined;
  const discovery: DiscoveryData = {
    people: rows.slice(0, pageSize).map((person) => presentPerson(person, profile?.id, relations)),
    query, page, hasNext: rows.length > pageSize, hasProfile: !!profile,
  };
  if (wantsJson(req)) return res.json(discovery);
  res.render("pages/discover", { title: "Discover", discovery });
});

discoverRouter.get("/:profileId/photo", async (req, res) => {
  const { db } = discoveryContext(req);
  const profileId = positiveId(req.params.profileId);
  const photo = await db.selectFrom("profile_photos")
    .innerJoin("profiles", "profiles.id", "profile_photos.profile_id")
    .select("profile_photos.image")
    .where("profiles.id", "=", profileId)
    .where("profiles.profile_picture", "=", PHOTO_URL)
    .executeTakeFirst();
  if (!photo) throw new HttpError(404, "Profile photo not found");
  res.set("X-Content-Type-Options", "nosniff");
  res.type("image/webp").send(Buffer.from(photo.image));
});
