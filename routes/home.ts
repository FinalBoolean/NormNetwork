import { Router } from "express";
import { sql } from "kysely";

export const homeRouter = Router();

homeRouter.get("/", (req, res) => {
  res.render("pages/home", { title: "Home" });
});

/**
 * Quick check that the server is up and can reach Postgres.
 * Visit http://localhost:3000/health after `npm run dev`.
 * Also an example of a route using the shared database: req.app.locals.db
 */
homeRouter.get("/health", async (req, res) => {
  const { db } = req.app.locals;
  let database = "unavailable";
  if (db) {
    try {
      await sql`select 1`.execute(db);
      database = "connected";
    } catch {
      // leave as "unavailable"
    }
  }
  res.json({ status: "ok", database });
});
