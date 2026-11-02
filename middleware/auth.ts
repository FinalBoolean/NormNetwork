import type { Request, Response, NextFunction } from "express";
import { HttpError } from "./errors.js";
import {
  SESSION_COOKIE,
  cookieOptions,
  findSessionUser,
  readCookie,
} from "../lib/sessions.js";

/**
 * Reads the session cookie and sets req.user / res.locals.currentUser
 * (null when logged out). Runs on every request.
 */
export async function loadUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.user = null;
  const token = readCookie(req, SESSION_COOKIE);
  const { db } = req.app.locals;
  if (token && db) {
    req.user = await findSessionUser(db, token);
    // Stale or unknown token: drop the cookie so the browser stops sending it.
    if (!req.user) res.clearCookie(SESSION_COOKIE, cookieOptions());
  }
  res.locals.currentUser = req.user;
  next();
}

/**
 * Put in front of any route that needs a logged-in user:
 *   router.get("/", requireAuth, handler)
 * Browsers are sent to /login and returned here afterwards; JSON clients get 401.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.user) return next();
  if (req.method === "GET" && req.accepts(["html", "json"]) === "html") {
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  throw new HttpError(401, "You need to log in first.");
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cross-site request forgery protection: rejects form posts and other
 * state-changing requests that a browser reports as coming from another site.
 * Together with the SameSite=Lax session cookie, this means another website
 * can't log a visitor out, or into an attacker's account, behind their back.
 * Non-browser clients (curl, tests) send neither header and are allowed.
 */
export function rejectCrossSite(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (SAFE_METHODS.has(req.method)) return next();
  const site = req.get("sec-fetch-site");
  if (site) {
    if (site === "same-origin" || site === "none") return next();
    throw new HttpError(403, "Cross-site requests are not allowed.");
  }
  // Older browsers without Sec-Fetch-Site: fall back to comparing Origin to Host.
  const origin = req.get("origin");
  if (origin) {
    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (originHost !== req.get("host")) {
      throw new HttpError(403, "Cross-site requests are not allowed.");
    }
  }
  next();
}
