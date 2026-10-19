import { Router } from "express";
import { placeholder } from "./placeholder.js";

// Discussion threads and replies. Tables: threads, threads_reply
export const threadsRouter = Router();

threadsRouter.get(
  "/",
  placeholder("Threads", "Start a discussion or reply to one.", ["threads", "threads_reply"]),
);
