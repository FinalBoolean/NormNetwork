import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

// Friends list and friend requests. Tables: friends, friend_request
// Everything here needs a logged-in user (req.user).
export const friendsRouter = Router();
friendsRouter.use(requireAuth);

friendsRouter.get("/", (_req, res) => {
  res.render("pages/friends", {
    title: "Friends",
    description: "Your friends and pending friend requests.",
  });
});
