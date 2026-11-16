import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { sendFriendRequest } from "../lib/friends.js";
import { context, wantsJson } from "./profiles.js";
 
export const friendsRouter = Router();
friendsRouter.use(requireAuth);
 
const NOTICES: Record<string, string> = { sent: "Friend request sent." };
 
friendsRouter.get("/", (req, res) => {
  const notice = Object.entries(NOTICES).find(
    ([param]) => req.query[param] === "1",
  )?.[1];
  res.render("pages/friends", {
    title: "Friends",
    description: "Your friends and pending friend requests.",
    notice,
  });
});
 
function parseId(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : NaN;
  return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}

friendsRouter.post("/requests", async (req, res) => {
  const { db, userId } = context(req);
  const receiverId = parseId(req.body?.receiver_id);
  if (receiverId === null)
    throw new HttpError(400, "Choose someone to send a request to.");
  const request = await sendFriendRequest(db, userId, receiverId);
  if (wantsJson(req)) return res.status(201).json(request);
  res.redirect(303, "/friends?sent=1");
});