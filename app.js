import express from "express";
import { fileURLToPath } from "node:url";
import { routes } from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/errors.js";

const fromRoot = (dir) => fileURLToPath(new URL(dir, import.meta.url));

/**
 * Builds the Express app without starting a server, so tests can create one
 * (see test/app.test.js). server.js is what actually listens on a port.
 *
 * @param {object} [options]
 * @param {import("kysely").Kysely<any>} [options.db] Shared database connection.
 *   Route handlers reach it as `req.app.locals.db`.
 */
export function createApp({ db } = {}) {
  const app = express();
  app.locals.db = db;

  // Views: EJS templates in views/, rendered with res.render("pages/<name>")
  app.set("view engine", "ejs");
  app.set("views", fromRoot("./views/"));

  // Request bodies: HTML form posts and JSON
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Static files: public/css/styles.css is served at /css/styles.css
  app.use(express.static(fromRoot("./public/")));

  // Values every template can read
  app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
  });

  app.use(routes);

  // Must stay last: 404 for unmatched routes, then the error page
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
