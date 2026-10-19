import { Router } from "express";
import { homeRouter } from "./home.js";
import { authRouter } from "./auth.js";
import { profilesRouter } from "./profiles.js";
import { finderRouter } from "./finder.js";
import { threadsRouter } from "./threads.js";
import { friendsRouter } from "./friends.js";

/**
 * Each feature has its own router file. To add a page, add a route to the
 * matching file. For a new feature, create a router and mount it here.
 */
export const routes = Router();

routes.use("/", homeRouter); // /, /health
routes.use("/", authRouter); // /login, /signup
routes.use("/profile", profilesRouter);
routes.use("/finder", finderRouter);
routes.use("/threads", threadsRouter);
routes.use("/friends", friendsRouter);
