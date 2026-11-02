import type { Kysely } from "kysely";
import type { Database } from "./db/types.js";
import type { RequestHandler } from "express";
import { reactPages } from "./lib/render.js";
import express from "express";
import { fileURLToPath } from "node:url";
import { routes } from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/errors.js";
import { loadUser, rejectCrossSite } from "./middleware/auth.js";

const fromRoot = (dir: string) => fileURLToPath(new URL(dir, import.meta.url));

/**
 * Builds the Express app without starting a server, so tests can create one
 * (see test/app.test.ts). server.ts is what actually listens on a port.
 *
 * Route handlers reach the shared database as `req.app.locals.db`.
 */
export function createApp({
  db,
  assets,
  clientScript,
}: {
  db?: Kysely<Database>;
  assets?: RequestHandler;
  clientScript?: string;
} = {}) {
  const app = express();
  app.locals.db = db;

  if (assets) app.use(assets);
  app.use(express.static(fromRoot("./dist/")));
  app.use(reactPages(clientScript));

  // Request bodies: HTML form posts and JSON
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Static files: public/css/styles.css is served at /css/styles.css
  app.use(express.static(fromRoot("./public/")));

  // Values passed to React pages
  app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
  });

  // Auth: block cross-site form posts, then load the logged-in user (req.user,
  // and currentUser in React pages) from the session cookie.
  app.use(rejectCrossSite);
  app.use(loadUser);

  app.use(routes);

  // Must stay last: 404 for unmatched routes, then the error page
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
