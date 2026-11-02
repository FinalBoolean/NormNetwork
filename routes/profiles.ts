import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

// Profiles: view and edit a student's profile. Tables: profiles
// Everything here needs a logged-in user (req.user).
export const profilesRouter = Router();
profilesRouter.use(requireAuth);

profilesRouter.get("/", (_req, res) => {
  res.render("pages/profile", {
    title: "Your profile",
    description: "Profile picture, bio, class, major and more.",
  });
});
