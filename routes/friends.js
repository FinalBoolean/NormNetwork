import { Router } from "express";
import { placeholder } from "./placeholder.js";

// Friends list and friend requests. Tables: friends, friend_request
export const friendsRouter = Router();

friendsRouter.get(
  "/",
  placeholder("Friends", "Your friends and pending friend requests.", ["friends", "friend_request"]),
);
