import { Router } from "express";
import { placeholder } from "./placeholder.js";

// Profiles: view and edit a student's profile. Tables: profiles
export const profilesRouter = Router();

profilesRouter.get(
  "/",
  placeholder("Your profile", "Profile picture, bio, class, major and more.", ["profiles"]),
);
