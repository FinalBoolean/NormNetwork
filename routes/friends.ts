import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import {
  getFriendList, getIncomingRequests, getOutgoingRequests, getProfileId,
  lockConnectionProfiles, orderedPair, sendFriendRequest,
} from "../lib/friends.js";
import {
  discoveryContext, positiveId, profilePhotoUrl, returnPath, wantsJson,
} from "../lib/discovery.js";
import type { ConnectionsData, DiscoveryPerson } from "../src/discovery.js";

// Friends list and friend requests. Tables: friends, friend_request.
export const friendsRouter = Router();
friendsRouter.use(requireAuth);
friendsRouter.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  res.vary("Accept");
  next();
});

const NOTICES: Record<string, string> = { sent: "Friend request sent." };

function connectionPerson(
  profile: Pick<DiscoveryPerson, "username" | "age" | "class" | "major" | "bio"> & { profile_picture: string | null },
  profileId: number,
  connection: DiscoveryPerson["connection"],
  requestId: number | null = null,
): DiscoveryPerson {
  return {
    profileId, username: profile.username, age: profile.age, class: profile.class,
    major: profile.major, bio: profile.bio,
    profilePicture: profilePhotoUrl(profileId, profile.profile_picture),
    connection, requestId,
  };
}

friendsRouter.get("/", async (req, res) => {
  const { db, userId } = discoveryContext(req);
  const profileId = await getProfileId(db, userId);
  const connections: ConnectionsData = { incoming: [], outgoing: [], friends: [], hasProfile: profileId !== null };
  if (profileId !== null) {
    // The page uses the same request join and friendship mapping as /request and /list.
    const [incoming, outgoing, friends] = await Promise.all([
      getIncomingRequests(db, profileId), getOutgoingRequests(db, profileId), getFriendList(db, profileId),
    ]);
    const friendIds = new Set(friends.map((friend) => friend.id));
    connections.friends = friends.map((friend) => connectionPerson(friend, friend.id, "friends"));
    connections.incoming = incoming.filter((request) => !friendIds.has(request.sender_id))
      .map((request) => connectionPerson(request, request.sender_id, "incoming", request.id));
    connections.outgoing = outgoing.filter((request) => !friendIds.has(request.receiver_id))
      .map((request) => connectionPerson(request, request.receiver_id, "sent", request.id));
  }
  if (wantsJson(req)) return res.json(connections);
  const notice = Object.entries(NOTICES).find(([param]) => req.query[param] === "1")?.[1];
  res.render("pages/friends", {
    title: "Friends", description: "Your friends and pending friend requests.", connections, notice,
  });
});

function connectionApiError(res: Response, error: unknown, fallback: string) {
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  console.error(error);
  return res.status(500).json({ error: fallback });
}

friendsRouter.get("/request", async (req, res) => {
  try {
    const { db, userId } = discoveryContext(req);
    const profileId = await getProfileId(db, userId);
    if (profileId === null) throw new HttpError(404, "Profile not found");
    const requests = await getIncomingRequests(db, profileId);
    return res.json(requests.map((request) => ({
      id: request.id, sender_id: request.sender_id, created_at: request.created_at,
      username: request.username,
      profile_picture: profilePhotoUrl(request.sender_id, request.profile_picture),
      bio: request.bio,
    })));
  } catch (error) {
    return connectionApiError(res, error, "Could not retrieve request");
  }
});

friendsRouter.get("/list", async (req, res) => {
  try {
    const { db, userId } = discoveryContext(req);
    const profileId = await getProfileId(db, userId);
    if (profileId === null) throw new HttpError(404, "Profile not found");
    const friends = await getFriendList(db, profileId);
    return res.json(friends.map((friend) => ({
      id: friend.id, profile_picture: profilePhotoUrl(friend.id, friend.profile_picture),
      bio: friend.bio, username: friend.username,
    })));
  } catch (error) {
    return connectionApiError(res, error, "Could not retrieve friends");
  }
});

function parseId(value: unknown): number | null {
  const n = typeof value === "number" ? value
    : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}

function isHtmlForm(req: Request) {
  // Ordinary fetch clients still receive the original JSON response, even with */*.
  return req.is("application/x-www-form-urlencoded") &&
    req.get("accept")?.includes("text/html") && req.accepts(["html", "json"]) === "html";
}

friendsRouter.post("/requests/:profileId", async (req, res) => {
  try {
    const { db, userId } = discoveryContext(req);
    if (await getProfileId(db, userId) === null) throw new HttpError(404, "Profile not found");
    const receiverId = parseId(req.params.profileId);
    if (receiverId === null) throw new HttpError(400, "Not a valid id");
    const request = await sendFriendRequest(db, userId, receiverId);
    if (isHtmlForm(req)) return res.redirect(303, returnPath(req.body?.returnTo, "/friends?sent=1"));
    return res.status(201).json({ message: "Friend request sent!", requestId: request.id });
  } catch (error) {
    if (isHtmlForm(req)) throw error;
    return connectionApiError(res, error, "Friend request could not be sent");
  }
});

friendsRouter.post("/requests", async (req, res) => {
  const { db, userId } = discoveryContext(req);
  const receiverId = parseId(req.body?.receiver_id);
  if (receiverId === null) throw new HttpError(400, "Choose someone to send a request to.");
  const request = await sendFriendRequest(db, userId, receiverId);
  if (wantsJson(req)) return res.status(201).json(request);
  res.redirect(303, returnPath(req.body?.returnTo, "/friends?sent=1"));
});

for (const action of ["accept", "decline"] as const) {
  friendsRouter.post("/requests/:id/" + action, async (req, res) => {
    const { db, userId } = discoveryContext(req);
    const requestId = positiveId(req.params.id, "Request ID");
    const profileId = await getProfileId(db, userId);
    if (profileId === null) throw new HttpError(409, "Create your profile before connecting with students.");
    const initial = await db.selectFrom("friend_request").selectAll()
      .where("id", "=", requestId).executeTakeFirst();
    if (!initial) throw new HttpError(404, "Friend request not found.");
    if (initial.receiver_id !== profileId) throw new HttpError(403, "Only the recipient can respond to this request.");
    const status = action === "accept" ? "accepted" : "declined";
    await db.transaction().execute(async (trx) => {
      await lockConnectionProfiles(trx, profileId, initial.sender_id, userId);
      const request = await trx.selectFrom("friend_request").select(["id", "status"])
        .where("id", "=", requestId).executeTakeFirst();
      if (!request) throw new HttpError(404, "Friend request not found.");
      if (request.status !== "pending") throw new HttpError(409, "This request has already been answered.");
      if (action === "accept") {
        const [a, b] = orderedPair(profileId, initial.sender_id);
        await trx.insertInto("friends").values({ profile_a_id: a, profile_b_id: b })
          .onConflict((oc) => oc.columns(["profile_a_id", "profile_b_id"]).doNothing()).execute();
      }
      await trx.updateTable("friend_request").set({ status }).where("id", "=", requestId).execute();
    });
    if (wantsJson(req)) return res.json({ status, requestId });
    res.redirect(303, returnPath(req.body?.returnTo, "/friends"));
  });
}
