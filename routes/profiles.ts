import { Router, type Request, type Response } from "express";
import { createDatabase } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";

const db = createDatabase();

// Profiles: view and edit a student's profile. Tables: profiles
// Everything here needs a logged-in user (req.user).
export const profilesRouter = Router();
profilesRouter.use(requireAuth);

profilesRouter.get("/", async function (req: Request, res: Response) {
  const userIdNum = (req as Request & {
  user: { id: number };
}).user.id;

  if (!Number.isInteger(userIdNum) || userIdNum <= 0) {
    return res.status(400).json({ error: "userId not a number"})
  };



const profile = await db 
.selectFrom("profiles")
.selectAll()
.where("user_id", "=", userIdNum)
.executeTakeFirst();

if (!profile) {
  return res.status(404).json({
    error: "profile not found", 
  })
}

return res.json(profile);
});

profilesRouter.post("/", async function (req: Request, res: Response) {
 const userIdNum = (req as Request & {
  user: { id: number };
}).user.id;

 if (!Number.isInteger(userIdNum) || userIdNum <= 0) {
    return res.status(400).json({ error: "Invalid user ID"})
  };

  const { 
    profile_picture,
    bio,
    age,
    class: studentClass,
    gender,
    major
  } = req.body;

  if (age === undefined || !studentClass || !gender || !major) {
    return res.status(400).json({
      error: "Missing requirements!"
    })
  }

  const user = await db
  .selectFrom("users")
  .select("id")
  .where("id", "=", userIdNum)
  .executeTakeFirst();

  if (!user) {
    return res.status(404).json({
      error: "User not found"
    });
  }

  const existingProfile = await db
  .selectFrom("profiles")
  .select("id")
  .where("user_id", "=", userIdNum)
  .executeTakeFirst();

  if (existingProfile) {
    return res.status(409).json({
      error: "Profile already exist"
    });
  }

  const profile = await db
  .insertInto("profiles")
  .values({
    user_id: userIdNum,
    profile_picture,
    bio,
    age,
    class: studentClass,
    gender,
    major
  })
  .returningAll()
  .executeTakeFirst();

return res.status(201).json(profile);
});

profilesRouter.delete("/", async function (req: Request, res: Response) {
   const userIdNum = (req as Request & {
  user: { id: number };
}).user.id;

  if (!Number.isInteger(userIdNum) || userIdNum <= 0) {
    return res.status(400).json({ error: "Invalid user ID"})
  };  

  const profile = await db
  .deleteFrom("profiles")
  .where("user_id", "=", userIdNum)
  .returningAll()
  .executeTakeFirst();

  if (!profile) {
    return res.status(404).json({
      error: "Profile not found"
    });
  }

  return res.json({
    message: "Profile Deleted",
    profile
  });
});

profilesRouter.patch("/", async function (req: Request, res: Response) {
   const userIdNum = (req as Request & {
  user: { id: number };
}).user.id;

    if (!Number.isInteger(userIdNum) || userIdNum <= 0) {
    return res.status(400).json({ error: "Invalid user ID"})
  };  

  const {
    profile_picture,
    bio,
    age,
    class: studentClass,
    gender,
    major
  } = req.body;

  const profile = await db
  .updateTable("profiles")
  .set({
    profile_picture,
    bio,
    age,
    class: studentClass,
    gender,
    major
  })
  .where("user_id", "=", userIdNum)
  .returningAll()
  .executeTakeFirst();

  if (!profile) {
    return res.status(404).json({
      error: "Profile not found"
    });
  }

  return res.json(profile);
})
