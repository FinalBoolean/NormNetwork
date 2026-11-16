import { Router } from "express";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { requireAuth } from "../middleware/auth.js";


// Friends list and friend requests. Tables: friends, friend_request
// Everything here needs a logged-in user (req.user).
export const friendsRouter = Router();
friendsRouter.use(requireAuth);
//get logged in user
async function getProfileId(
  db: Kysely<Database>,
  userId: number,
): Promise<number | null> {
  const profile = await db
    .selectFrom("profiles")
    .select("id")
    .where("user_id", "=", userId)
    .executeTakeFirst();

    return profile?.id ?? null
}


friendsRouter.get("/", (_req, res) => {
  res.render("pages/friends", {
    title: "Friends",
    description: "Your friends and pending friend requests.",
  });
});

friendsRouter.get("/request", async (req, res) => {
  try {
    const db = req.app.locals.db;
  

  if (!db || !req.user) {
    return res.status(500).json({
      error: "Database unavailable.",
    });
  }
  const profileId = await getProfileId(db, req.user.id);

  if (!profileId) {
    return res.status(404).json({
      error: "Profile not found",
    
    });
  }
  const request = await db
  .selectFrom("friend_request")
  .innerJoin(
    "profiles",
    "profiles.id",
    "friend_request.sender_id",
  )
    .innerJoin(
      "users",
      "users.id",
      "profiles.user_id",
    )
    .select([
    "friend_request.id",
    "friend_request.sender_id",
    "friend_request.created_at",
    "users.username",
    "profiles.profile_picture",
    "profiles.bio"
    ])
    .where("friend_request.receiver_id", "=", profileId)
    .where("friend_request.status", "=", "pending")
    .execute();
    
  return res.json(request)
} catch (error) {
  console.error(error);

  return res.status(500).json({
    error: "Could not retrieve request",
  });
}
});

friendsRouter.get("/list", async (req, res) => {
  try {
    const db = req.app.locals.db;

    if (!db || !req.user) {
      return res.status(500).json({
        error: "Database unavailable",
      });
    }
    const profileId = await getProfileId(db, req.user.id);

    if (!profileId) {
      return res.status(404).json({
        error: "Profile not found",
      });
    }
    const connections = await db
      .selectFrom("friends")
      .select(["profile_a_id", "profile_b_id"])
      .where((eb) =>
        eb.or([
          eb("profile_a_id", "=", profileId),
          eb("profile_b_id", "=", profileId),
        ]),
      )
      .execute()

  const connectionId = connections.map((connection) => {
    if (connection.profile_a_id === profileId) {
      return connection.profile_b_id;
    } else {
      return connection.profile_a_id;
    }
  });

  if (connectionId.length === 0) {
    return res.json([]);
  }
  
  const friends = await db
    .selectFrom("profiles")
    .innerJoin("users", "users.id", "profiles.user_id")
    .select([
      "profiles.id",
      "profiles.profile_picture",
      "profiles.bio",
      "users.username"
    ])
    .where("profiles.id", "in", connectionId)
    .execute()

  return res.json(friends);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "could not retrieve friends",
    });
  }
});

friendsRouter.post("/requests/:profileId", async (req, res) => {
  try {
      const db = req.app.locals.db;

      if (!db || !req.user) {
        return res.status(500).json({
          error: "Database unavailable",
        });
      }

      const senderId = await getProfileId(db, req.user.id);
      const receiverId = Number(req.params.profileId);

      if (!senderId) {
        return res.status(404).json({
          error: "Profile not found"
        });
      }

    if (!Number.isInteger(receiverId) || receiverId <= 0) {
      return res.status(400).json({
        error: "Not a valid id"
      });
    }

    if (senderId === receiverId) {
      return res.status(400).json({
    error: "Friend request cannot be sent to self",
  });
}
  
    const receiver = await db
      .selectFrom("profiles")
      .select("id")
      .where("id", "=", receiverId)
      .executeTakeFirst();

      if (!receiver) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      const existingFriend = await db
        .selectFrom("friends")
        .select("profile_a_id")
        .where("profile_a_id", "=", Math.min(senderId, receiverId))
        .where("profile_b_id", "=", Math.max(senderId, receiverId))
        .executeTakeFirst();

      if (existingFriend) {
        return res.status(409).json({
          error: "Already friends!"
        });
      }

    const existingRequest = await db
      .selectFrom("friend_request")
      .select("id")
      .where("status", "=", "pending")
      .where((eb) =>
      eb.or([
        eb.and([
          eb("sender_id", "=", senderId),
          eb("receiver_id", "=", receiverId),
        ]),

        eb.and([
          eb("sender_id", "=", receiverId),
          eb("receiver_id", "=", senderId),
        ]),
      ]),
    )
    .executeTakeFirst();

    if (existingRequest) {
      return res.status(409).json({
        error: "Request already exist"
      });
    }

    const request = await db
      .insertInto("friend_request")
      .values({
        sender_id: senderId,
        receiver_id: receiverId,
        status: "pending",
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    return res.status(201).json({
      message: "Friend request sent!",
      requestId: request.id,
    });
} catch (error) {
console.error(error);

return res.status(500).json({
  error: "Friend request could not be sent",
});
}
});
