import { Router } from "express";
import { placeholder } from "./placeholder.js";
import { requireAuth } from "../middleware/auth.js";

// Friends list and friend requests. Tables: friends, friend_request
// Everything here needs a logged-in user (req.user).
export const friendsRouter = Router();
friendsRouter.use(requireAuth);

friendsRouter.get(
  "/",
  placeholder("Friends", "Your friends and pending friend requests.", [
    "friends",
    "friend_request",
  ]),
);
