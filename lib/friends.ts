import type { Kysely, Selectable, Transaction } from "kysely";
import type { Database } from "../db/types.js";
import { HttpError } from "../middleware/errors.js";

export type FriendRequest = Selectable<Database["friend_request"]>;

export function orderedPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
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
      const me = await trx.selectFrom("profiles").select("id")
        .where("user_id", "=", userId).executeTakeFirst();
      if (!me)
        throw new HttpError(409, "Save your profile before sending friend requests.");
      if (me.id === receiverId)
        throw new HttpError(400, "You can't send a friend request to yourself.");

      await lockConnectionProfiles(trx, me.id, receiverId, userId);
      const [a, b] = orderedPair(me.id, receiverId);
      const alreadyFriends = await trx.selectFrom("friends").select("profile_a_id")
        .where("profile_a_id", "=", a).where("profile_b_id", "=", b).executeTakeFirst();
      if (alreadyFriends) throw new HttpError(409, "You're already friends.");

      const pending = await trx.selectFrom("friend_request").select("sender_id")
        .where("status", "=", "pending")
        .where((eb) => eb.or([
          eb.and([eb("sender_id", "=", me.id), eb("receiver_id", "=", receiverId)]),
          eb.and([eb("sender_id", "=", receiverId), eb("receiver_id", "=", me.id)]),
        ])).executeTakeFirst();
      if (pending) {
        throw new HttpError(
          409,
          pending.sender_id === me.id
            ? "You already sent this person a request."
            : "This person already sent you a request. Accept it from your Friends page.",
        );
      }
      return trx.insertInto("friend_request")
        .values({ sender_id: me.id, receiver_id: receiverId })
        .returningAll().executeTakeFirstOrThrow();
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      throw new HttpError(409, "A request between you two is already pending.");
    throw error;
  }
}
