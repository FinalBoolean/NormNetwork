import { Router } from "express";

// Discussion threads and replies. Tables: threads, threads_reply
export const threadsRouter = Router();

threadsRouter.get("/", (_req, res) => {
  res.render("pages/threads", {
    title: "Threads",
    description: "Start a discussion or reply to one.",
  });
});
