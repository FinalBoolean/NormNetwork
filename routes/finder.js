import { Router } from "express";
import { placeholder } from "./placeholder.js";

// Finders: match students by interests, courses, and games.
// Tables: friend_finder, study_finder, gaming_finder
export const finderRouter = Router();

finderRouter.get("/", (req, res) => res.redirect("/finder/friends"));

finderRouter.get(
  "/friends",
  placeholder("Friend Finder", "Meet Niners who share your interests.", ["friend_finder"]),
);
finderRouter.get(
  "/study",
  placeholder("Study Finder", "Find study partners for your courses.", ["study_finder"]),
);
finderRouter.get(
  "/gaming",
  placeholder("Gaming Finder", "Find teammates by game, rank, and role.", ["gaming_finder"]),
);
