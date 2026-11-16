import type { Kysely, Selectable, Transaction } from "kysely";
import type { Database } from "../db/types.js";
import { HttpError } from "../middleware/errors.js";

export type FriendRequest = Selectable<Database["friend_request"]>;

export function orderedPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}

// Shared with the original connection endpoints and the Friends page.
export async function getProfileId(db: Kysely<Database>, userId: number): Promise<number | null> {
  const profile = await db.selectFrom("profiles").select("id")
    .where("user_id", "=", userId).executeTakeFirst();
  return profile?.id ?? null;
}

export function getIncomingRequests(db: Kysely<Database>, profileId: number) {
  return db.selectFrom("friend_request")
    .innerJoin("profiles", "profiles.id", "friend_request.sender_id")
    .innerJoin("users", "users.id", "profiles.user_id")
    .select([
      "friend_request.id", "friend_request.sender_id", "friend_request.created_at",
      "users.username", "profiles.profile_picture", "profiles.bio",
      "profiles.age", "profiles.class", "profiles.major",
    ])
    .where("friend_request.receiver_id", "=", profileId)
    .where("friend_request.status", "=", "pending")
    .orderBy("users.username", "asc").orderBy("friend_request.id", "asc")
    .execute();
}

export async function getFriendList(db: Kysely<Database>, profileId: number) {
  const connections = await db.selectFrom("friends")
    .select(["profile_a_id", "profile_b_id"])
    .where((eb) => eb.or([
      eb("profile_a_id", "=", profileId), eb("profile_b_id", "=", profileId),
    ])).execute();
  const connectionIds = connections.map((connection) =>
    connection.profile_a_id === profileId ? connection.profile_b_id : connection.profile_a_id);
  if (!connectionIds.length) return [];
  return db.selectFrom("profiles")
    .innerJoin("users", "users.id", "profiles.user_id")
    .select([
      "profiles.id", "profiles.profile_picture", "profiles.bio", "users.username",
      "profiles.age", "profiles.class", "profiles.major",
    ])
    .where("profiles.id", "in", connectionIds)
    .orderBy("users.username", "asc").orderBy("profiles.id", "asc")
    .execute();
}

export function getOutgoingRequests(db: Kysely<Database>, profileId: number) {
  return db.selectFrom("friend_request")
    .innerJoin("profiles", "profiles.id", "friend_request.receiver_id")
    .innerJoin("users", "users.id", "profiles.user_id")
    .select([
      "friend_request.id", "friend_request.receiver_id", "users.username",
      "profiles.profile_picture", "profiles.bio", "profiles.age", "profiles.class", "profiles.major",
    ])
    .where("friend_request.sender_id", "=", profileId)
    .where("friend_request.status", "=", "pending")
    .orderBy("users.username", "asc").orderBy("friend_request.id", "asc")
    .execute();
}

export async function lockConnectionProfiles(
  trx: Transaction<Database>,
  ownId: number,
  otherId: number,
  userId: number,
) {
  // Sending and answering requests lock both profiles in the same order. This
  // prevents a send from racing acceptance after its already-friends check.
  const rows = await trx.selectFrom("profiles").select(["id", "user_id"])
    .where("id", "in", [ownId, otherId]).orderBy("id", "asc").forUpdate().execute();
  if (!rows.some((row) => row.id === ownId && row.user_id === userId))
    throw new HttpError(409, "Save your profile before sending friend requests.");
  if (!rows.some((row) => row.id === otherId))
    throw new HttpError(404, "Profile not found.");
}

export async function sendFriendRequest(
  db: Kysely<Database>,
  userId: number,
  receiverId: number,
): Promise<FriendRequest> {
  try {
    return await db.transaction().execute(async (trx) => {
      const senderId = await getProfileId(trx, userId);
      if (!senderId)
        throw new HttpError(409, "Save your profile before sending friend requests.");
      if (senderId === receiverId)
        throw new HttpError(400, "You can't send a friend request to yourself.");

      await lockConnectionProfiles(trx, senderId, receiverId, userId);
      const [a, b] = orderedPair(senderId, receiverId);
      const alreadyFriends = await trx.selectFrom("friends").select("profile_a_id")
        .where("profile_a_id", "=", a).where("profile_b_id", "=", b).executeTakeFirst();
      if (alreadyFriends) throw new HttpError(409, "You're already friends.");

      const pending = await trx.selectFrom("friend_request").select("sender_id")
        .where("status", "=", "pending")
        .where((eb) => eb.or([
          eb.and([eb("sender_id", "=", senderId), eb("receiver_id", "=", receiverId)]),
          eb.and([eb("sender_id", "=", receiverId), eb("receiver_id", "=", senderId)]),
        ])).executeTakeFirst();
      if (pending) {
        throw new HttpError(
          409,
          pending.sender_id === senderId
            ? "You already sent this person a request."
            : "This person already sent you a request. Accept it from your Friends page.",
        );
      }
      return trx.insertInto("friend_request")
        .values({ sender_id: senderId, receiver_id: receiverId })
        .returningAll().executeTakeFirstOrThrow();
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      throw new HttpError(409, "A request between you two is already pending.");
    throw error;
  }
}
