import { Router } from "express";

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
