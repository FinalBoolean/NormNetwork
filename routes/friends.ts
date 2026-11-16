import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { lockConnectionProfiles, orderedPair, sendFriendRequest } from "../lib/friends.js";
import {
  discoveryContext, ownProfile, peopleQuery, positiveId, presentPerson, relationships, returnPath, wantsJson,
} from "../lib/discovery.js";
import type { ConnectionsData } from "../src/discovery.js";

export const friendsRouter = Router();
friendsRouter.use(requireAuth);
friendsRouter.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  res.vary("Accept");
  next();
});

const NOTICES: Record<string, string> = { sent: "Friend request sent." };

friendsRouter.get("/", async (req, res) => {
  const { db, userId } = discoveryContext(req);
  const profile = await ownProfile(db, userId);
  const connections: ConnectionsData = { incoming: [], outgoing: [], friends: [], hasProfile: !!profile };
  if (profile) {
    const relations = await relationships(db, profile.id);
    const ids = new Set<number>();
    for (const row of relations.friends) {
      ids.add(row.profile_a_id === profile.id ? row.profile_b_id : row.profile_a_id);
    }
    for (const row of relations.requests) {
      ids.add(row.sender_id === profile.id ? row.receiver_id : row.sender_id);
    }
    if (ids.size) {
      const people = await peopleQuery(db).where("profiles.id", "in", [...ids])
        .orderBy("users.username", "asc").orderBy("profiles.id", "asc").execute();
      for (const row of people) {
        const person = presentPerson(row, profile.id, relations);
        if (person.connection === "friends") connections.friends.push(person);
        if (person.connection === "incoming") connections.incoming.push(person);
        if (person.connection === "sent") connections.outgoing.push(person);
      }
    }
  }
  if (wantsJson(req)) return res.json(connections);
  const notice = Object.entries(NOTICES).find(([param]) => req.query[param] === "1")?.[1];
  res.render("pages/friends", {
    title: "Friends",
    description: "Your friends and pending friend requests.",
    connections,
    notice,
  });
});

function parseId(value: unknown): number | null {
  const n = typeof value === "number" ? value
    : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}

friendsRouter.post("/requests", async (req, res) => {
  const { db, userId } = discoveryContext(req);
  const receiverId = parseId(req.body?.receiver_id);
  if (receiverId === null)
    throw new HttpError(400, "Choose someone to send a request to.");
  const request = await sendFriendRequest(db, userId, receiverId);
  if (wantsJson(req)) return res.status(201).json(request);
  res.redirect(303, returnPath(req.body?.returnTo, "/friends?sent=1"));
});

for (const action of ["accept", "decline"] as const) {
  friendsRouter.post("/requests/:id/" + action, async (req, res) => {
    const { db, userId } = discoveryContext(req);
    const requestId = positiveId(req.params.id, "Request ID");
    const profile = await ownProfile(db, userId);
    if (!profile) throw new HttpError(409, "Create your profile before connecting with students.");
    const initial = await db.selectFrom("friend_request").selectAll()
      .where("id", "=", requestId).executeTakeFirst();
    if (!initial) throw new HttpError(404, "Friend request not found.");
    if (initial.receiver_id !== profile.id)
      throw new HttpError(403, "Only the recipient can respond to this request.");
    const status = action === "accept" ? "accepted" : "declined";
    await db.transaction().execute(async (trx) => {
      await lockConnectionProfiles(trx, profile.id, initial.sender_id, userId);
      const request = await trx.selectFrom("friend_request").select(["id", "status"])
        .where("id", "=", requestId).executeTakeFirst();
      if (!request) throw new HttpError(404, "Friend request not found.");
      if (request.status !== "pending") throw new HttpError(409, "This request has already been answered.");
      if (action === "accept") {
        const [a, b] = orderedPair(profile.id, initial.sender_id);
        await trx.insertInto("friends").values({ profile_a_id: a, profile_b_id: b })
          .onConflict((oc) => oc.columns(["profile_a_id", "profile_b_id"]).doNothing()).execute();
      }
      await trx.updateTable("friend_request").set({ status }).where("id", "=", requestId).execute();
    });
    if (wantsJson(req)) return res.json({ status, requestId });
    res.redirect(303, returnPath(req.body?.returnTo, "/friends"));
  });
}
