import { Router } from "express";
import { placeholder } from "./placeholder.js";
import { requireAuth } from "../middleware/auth.js";

// Profiles: view and edit a student's profile. Tables: profiles
// Everything here needs a logged-in user (req.user).
export const profilesRouter = Router();
profilesRouter.use(requireAuth);

profilesRouter.get(
  "/",
  placeholder("Your profile", "Profile picture, bio, class, major and more.", [
    "profiles",
  ]),
);
