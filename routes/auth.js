import { Router } from "express";
import { sql } from "kysely";
import { HttpError } from "../middleware/errors.js";
import { burnPasswordCheck, hashPassword, verifyPassword } from "../lib/passwords.js";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  cookieOptions,
  createSession,
  deleteSession,
  readCookie,
} from "../lib/sessions.js";
import { safeRedirect, validateLogin, validateSignup } from "../lib/validation.js";

// Accounts: sign up, log in, log out. Tables: users, sessions
export const authRouter = Router();

const INVALID_LOGIN = "That email/username and password don't match an account.";

function requireDb(req) {
  const { db } = req.app.locals;
  if (!db) throw new HttpError(503, "Accounts are unavailable: the database isn't connected.");
  return db;
}

async function startSession(req, res, userId) {
  const db = requireDb(req);
  // Replace any session this browser already had.
  await deleteSession(db, readCookie(req, SESSION_COOKIE));
  const { token } = await createSession(db, userId);
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_TTL_MS });
}

const renderSignup = (res, status, { values = {}, errors = {}, next } = {}) =>
  res.status(status).render("pages/signup", { title: "Sign up", values, errors, next });

const renderLogin = (res, status, { values = {}, errors = {}, next, notice } = {}) =>
  res.status(status).render("pages/login", { title: "Log in", values, errors, next, notice });

// ---------- Sign up ----------

authRouter.get("/signup", (req, res) => {
  if (req.user) return res.redirect("/");
  renderSignup(res, 200, { next: safeRedirect(req.query.next, "") });
});

authRouter.post("/signup", async (req, res) => {
  const next = safeRedirect(req.body?.next, "");
  const { values, errors } = validateSignup(req.body);
  // Never send the password back to the page.
  const shown = { username: values.username, email: values.email };
  if (Object.keys(errors).length) return renderSignup(res, 400, { values: shown, errors, next });

  const db = requireDb(req);
  const taken = await db
    .selectFrom("users")
    .select(["email", "username"])
    .where((eb) =>
      eb.or([
        eb("email", "=", values.email),
        eb(sql`lower(username)`, "=", values.username.toLowerCase()),
      ]),
    )
    .execute();
  const conflicts = {};
  for (const row of taken) {
    if (row.email === values.email)
      conflicts.email = "An account with that email already exists. Try logging in.";
    if (row.username.toLowerCase() === values.username.toLowerCase())
      conflicts.username = "That username is taken.";
  }
  if (Object.keys(conflicts).length)
    return renderSignup(res, 409, { values: shown, errors: conflicts, next });

  let user;
  try {
    user = await db
      .insertInto("users")
      .values({
        username: values.username,
        email: values.email,
        password_hash: await hashPassword(values.password),
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();
  } catch (err) {
    // Two sign-ups racing for the same email/username: the unique index wins.
    if (err?.code === "23505") {
      const field = String(err.constraint ?? err.message).includes("username") ? "username" : "email";
      const message = field === "username" ? "That username is taken." : "An account with that email already exists. Try logging in.";
      return renderSignup(res, 409, { values: shown, errors: { [field]: message }, next });
    }
    throw err;
  }

  await startSession(req, res, user.id);
  res.redirect(303, next || "/");
});

// ---------- Log in ----------

authRouter.get("/login", (req, res) => {
  if (req.user) return res.redirect(safeRedirect(req.query.next));
  renderLogin(res, 200, {
    next: safeRedirect(req.query.next, ""),
    notice: req.query.logged_out !== undefined ? "You've been logged out." : undefined,
  });
});

authRouter.post("/login", async (req, res) => {
  const next = safeRedirect(req.body?.next, "");
  const { values, errors } = validateLogin(req.body);
  const shown = { login: values.login };
  if (Object.keys(errors).length) return renderLogin(res, 400, { values: shown, errors, next });

  const db = requireDb(req);
  const login = values.login.toLowerCase();
  const user = await db
    .selectFrom("users")
    .select(["id", "password_hash"])
    .where(login.includes("@") ? sql`email` : sql`lower(username)`, "=", login)
    .executeTakeFirst();

  const ok = user
    ? await verifyPassword(values.password, user.password_hash)
    : await burnPasswordCheck(values.password);
  // Same message for unknown account and wrong password, so the form can't be
  // used to find out who has an account.
  if (!ok) return renderLogin(res, 401, { values: shown, errors: { form: INVALID_LOGIN }, next });

  await startSession(req, res, user.id);
  res.redirect(303, next || "/");
});

// ---------- Log out ----------

// POST only: a GET link could be triggered by an <img> tag on another site.
authRouter.post("/logout", async (req, res) => {
  const token = readCookie(req, SESSION_COOKIE);
  const { db } = req.app.locals;
  if (token && db) await deleteSession(db, token);
  res.clearCookie(SESSION_COOKIE, cookieOptions());
  res.redirect(303, "/login?logged_out");
});
