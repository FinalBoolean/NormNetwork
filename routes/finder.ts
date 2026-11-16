import { Router } from "express";
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

finderRouter.get("/study", (_req, res) => {
  res.render("pages/study_finder", {
    title: "Study Finder",
    description: "Find study partners for your courses.",
  });
});

finderRouter.get("/gaming", (_req, res) => {
  res.render("pages/gaming_finder", {
    title: "Gaming Finder",
    description: "Find teammates by game, rank, and role.",
  });
});
