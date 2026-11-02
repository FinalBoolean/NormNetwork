import type { AddressInfo } from "node:net";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { NO_MIGRATIONS } from "kysely/migration";
import { createApp } from "../app.js";
import { createMigrator } from "../db/migrator.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import { SESSION_COOKIE } from "../lib/sessions.js";
import { safeRedirect, validateSignup } from "../lib/validation.js";
import { createTestDatabase } from "./helpers/db.js";

// ---------- helpers ----------

/** Starts an app on a random port. Returns { baseUrl, close }. */
async function startServer(options: Parameters<typeof createApp>[0] = {}) {
  const server = createApp(options).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  return {
    baseUrl: `http://localhost:${(server.address() as AddressInfo).port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

// React escapes quotes; undo that so assertions can use normal text.
const decode = (html: string) =>
  html
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll("&#34;", '"')
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

/** Returns the session token set by a response, "" if it was cleared, or undefined. */
function sessionFrom(res: Response) {
  for (const header of res.headers.getSetCookie()) {
    const [pair] = header.split(";");
    const [name, value] = pair.split("=");
    if (name === SESSION_COOKIE) return value;
  }
  return undefined;
}

function setCookieHeader(res: Response) {
  return res.headers
    .getSetCookie()
    .find((h) => h.startsWith(`${SESSION_COOKIE}=`));
}

let n = 0;
const unique = () => `${Date.now().toString(36)}${n++}`;
const PASSWORD = "correct horse battery";

// ---------- unit tests ----------

describe("password hashing", () => {
  test("hashes verify against the right password only", async () => {
    const hash = await hashPassword(PASSWORD);
    assert.match(hash, /^scrypt\$16384\$8\$1\$/);
    assert.ok(!hash.includes(PASSWORD));
    assert.equal(await verifyPassword(PASSWORD, hash), true);
    assert.equal(await verifyPassword("wrong password", hash), false);
  });

  test("the same password gets a different salt each time", async () => {
    assert.notEqual(await hashPassword(PASSWORD), await hashPassword(PASSWORD));
  });

  test("malformed or legacy hashes never verify", async () => {
    for (const bad of [
      undefined,
      "",
      "test-hash",
      "scrypt$x$y$z$abc$def",
      "bcrypt$1$2$3$4$5",
    ]) {
      assert.equal(await verifyPassword(PASSWORD, bad), false, String(bad));
    }
  });
});

describe("sign-up validation", () => {
  const valid = {
    username: "norm_49er",
    email: "  Norm@Charlotte.edu ",
    password: PASSWORD,
    confirmPassword: PASSWORD,
  };

  test("accepts valid input and normalizes the email", () => {
    const { values, errors } = validateSignup(valid);
    assert.deepEqual(errors, {});
    assert.equal(values.email, "norm@charlotte.edu");
  });

  test("accepts legacy @uncc.edu addresses", () => {
    assert.deepEqual(
      validateSignup({ ...valid, email: "norm@uncc.edu" }).errors,
      {},
    );
  });

  for (const [name, change, field] of [
    ["missing username", { username: "" }, "username"],
    ["short username", { username: "ab" }, "username"],
    ["username with spaces", { username: "norm the niner" }, "username"],
    ["username over 30 chars", { username: "a".repeat(31) }, "username"],
    ["missing email", { email: "" }, "email"],
    ["malformed email", { email: "not-an-email" }, "email"],
    ["non-UNCC email", { email: "norm@gmail.com" }, "email"],
    ["look-alike domain", { email: "norm@charlotte.edu.evil.com" }, "email"],
    [
      "short password",
      { password: "short", confirmPassword: "short" },
      "password",
    ],
    [
      "huge password",
      { password: "x".repeat(129), confirmPassword: "x".repeat(129) },
      "password",
    ],
    [
      "mismatched confirmation",
      { confirmPassword: "something else" },
      "confirmPassword",
    ],
    [
      "non-string fields",
      { username: ["a", "b"], email: { x: 1 } },
      "username",
    ],
  ] as const) {
    test(`rejects ${name}`, () => {
      assert.ok(validateSignup({ ...valid, ...change }).errors[field]);
    });
  }
});

describe("safeRedirect", () => {
  test("keeps local paths and rejects anything that leaves the site", () => {
    assert.equal(safeRedirect("/profile?tab=bio"), "/profile?tab=bio");
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "profile",
      "/x\nSet-Cookie:",
      undefined,
      ["/a"],
    ]) {
      assert.equal(safeRedirect(bad), "/", String(bad));
    }
  });
});

// ---------- integration tests (app + database) ----------

describe("authentication", () => {
  let db: ReturnType<typeof createTestDatabase>;
  let app: Awaited<ReturnType<typeof startServer>>;

  type Options = RequestInit & { cookie?: string };
  const request = (
    path: string,
    { cookie, headers = {}, ...init }: Options = {},
  ) =>
    fetch(`${app.baseUrl}${path}`, {
      redirect: "manual",
      ...init,
      headers: {
        ...(cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {}),
        ...headers,
      },
    });
  const get = (path: string, options?: Options) => request(path, options);
  const post = (
    path: string,
    fields: Record<string, string> = {},
    options?: Options,
  ) =>
    request(path, {
      ...options,
      method: "POST",
      body: new URLSearchParams(fields),
    });

  /** Creates an account through the sign-up form. Returns its details and session token. */
  async function signUp(overrides: Record<string, string> = {}) {
    const id = unique();
    const fields = {
      username: `user_${id}`,
      email: `user_${id}@charlotte.edu`,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      ...overrides,
    };
    const res = await post("/signup", fields);
    assert.equal(
      res.status,
      303,
      `sign-up failed: ${decode(await res.text())}`,
    );
    return { ...fields, token: sessionFrom(res) };
  }

  const countUsers = async () =>
    Number(
      (
        await db
          .selectFrom("users")
          .select((eb) => eb.fn.countAll().as("n"))
          .executeTakeFirstOrThrow()
      ).n,
    );

  before(async () => {
    db = createTestDatabase();
    const { error } = await createMigrator(db).migrateToLatest();
    if (error) throw error;
    app = await startServer({ db });
  });

  after(async () => {
    await app?.close();
    // Leave a shared CI database empty for the next test file.
    await createMigrator(db).migrateTo(NO_MIGRATIONS);
    await db.destroy();
  });

  describe("registration", () => {
    test("sign-up page shows the form", async () => {
      const res = await get("/signup");
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.match(html, /<form[^>]+action="\/signup"/);
      for (const field of [
        "username",
        "email",
        "password",
        "confirmPassword",
      ]) {
        assert.match(html, new RegExp(`name="${field}"`));
      }
    });

    test("creates the account, stores a hashed password, and logs the user in", async () => {
      const id = unique();
      const res = await post("/signup", {
        username: `Norm_${id}`,
        email: `  Norm_${id}@Charlotte.EDU `,
        password: PASSWORD,
        confirmPassword: PASSWORD,
      });
      assert.equal(res.status, 303);
      assert.equal(res.headers.get("location"), "/");

      const cookie = setCookieHeader(res);
      assert.ok(cookie, "session cookie is set");
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /SameSite=Lax/i);
      assert.match(cookie, /Path=\//);
      assert.match(cookie, /Max-Age=\d+/);

      const user = await db
        .selectFrom("users")
        .selectAll()
        .where("username", "=", `Norm_${id}`)
        .executeTakeFirstOrThrow();
      assert.equal(
        user.email,
        `norm_${id}@charlotte.edu`,
        "email is trimmed and lowercased",
      );
      assert.notEqual(user.password_hash, PASSWORD);
      assert.equal(await verifyPassword(PASSWORD, user.password_hash), true);

      // Only a hash of the token is stored.
      const sessions = await db
        .selectFrom("sessions")
        .selectAll()
        .where("user_id", "=", user.id)
        .execute();
      assert.equal(sessions.length, 1);
      assert.notEqual(sessions[0].token_hash, sessionFrom(res));

      const home = decode(
        await (await get("/", { cookie: sessionFrom(res) })).text(),
      );
      assert.match(home, new RegExp(`Welcome back, Norm_${id}`));
      assert.match(home, /action="\/logout"/);
      assert.doesNotMatch(home, /href="\/login"/);
    });

    test("invalid input re-renders the form with field errors and keeps safe values", async () => {
      const before = await countUsers();
      const res = await post("/signup", {
        username: "x",
        email: "someone@gmail.com",
        password: "short-pw",
        confirmPassword: "different",
      });
      assert.equal(res.status, 400);
      assert.equal(sessionFrom(res), undefined, "no session on failure");
      const html = decode(await res.text());
      assert.match(html, /Please fix the highlighted fields/);
      assert.match(html, /Usernames are 3–30 characters/);
      assert.match(html, /Use your UNC Charlotte email/);
      assert.match(html, /Passwords don't match/);
      assert.match(html, /value="x"/, "username is kept");
      assert.match(html, /value="someone@gmail.com"/, "email is kept");
      assert.doesNotMatch(
        html,
        /short-pw|different/,
        "passwords are never echoed back",
      );
      assert.equal(await countUsers(), before);
    });

    test("an empty submission reports every required field", async () => {
      const res = await post("/signup", {});
      assert.equal(res.status, 400);
      const html = decode(await res.text());
      assert.match(html, /Choose a username/);
      assert.match(html, /Enter your UNC Charlotte email/);
      assert.match(html, /Choose a password/);
    });

    test("user input is HTML-escaped when the form is re-rendered", async () => {
      const res = await post("/signup", {
        username: `<script>alert(1)</script>`,
        email: "",
      });
      assert.equal(res.status, 400);
      const html = await res.text();
      assert.doesNotMatch(html, /<script>alert/);
      assert.match(html, /&lt;script&gt;alert/);
    });

    test("an email that's already registered (any case) is rejected with 409", async () => {
      const existing = await signUp();
      const before = await countUsers();
      const res = await post("/signup", {
        username: `other_${unique()}`,
        email: existing.email.toUpperCase(),
        password: PASSWORD,
        confirmPassword: PASSWORD,
      });
      assert.equal(res.status, 409);
      assert.match(
        decode(await res.text()),
        /An account with that email already exists/,
      );
      assert.equal(await countUsers(), before);
    });

    test("a username that's taken (any case) is rejected with 409", async () => {
      const existing = await signUp();
      const res = await post("/signup", {
        username: existing.username.toUpperCase(),
        email: `other_${unique()}@charlotte.edu`,
        password: PASSWORD,
        confirmPassword: PASSWORD,
      });
      assert.equal(res.status, 409);
      assert.match(decode(await res.text()), /That username is taken/);
    });

    test("simultaneous sign-ups for the same account create exactly one user", async () => {
      const id = unique();
      const fields = {
        username: `race_${id}`,
        email: `race_${id}@charlotte.edu`,
        password: PASSWORD,
        confirmPassword: PASSWORD,
      };
      const results = await Promise.all([
        post("/signup", fields),
        post("/signup", fields),
        post("/signup", fields),
      ]);
      const statuses = results.map((r) => r.status).sort();
      assert.deepEqual(statuses, [303, 409, 409]);
      const rows = await db
        .selectFrom("users")
        .select("id")
        .where("email", "=", fields.email)
        .execute();
      assert.equal(rows.length, 1);
    });

    test("sign-up sends the user back to a local ?next page", async () => {
      const id = unique();
      const res = await post("/signup", {
        username: `next_${id}`,
        email: `next_${id}@charlotte.edu`,
        password: PASSWORD,
        confirmPassword: PASSWORD,
        next: "/friends",
      });
      assert.equal(res.status, 303);
      assert.equal(res.headers.get("location"), "/friends");
    });

    test("logged-in users visiting /signup are sent home", async () => {
      const { token } = await signUp();
      const res = await get("/signup", { cookie: token });
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "/");
    });
  });

  describe("login", () => {
    test("login page shows the form", async () => {
      const res = await get("/login");
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.match(html, /<form[^>]+action="\/login"/);
      assert.match(html, /name="login"/);
      assert.match(html, /name="password"/);
    });

    test("logs in with email (any case) and starts a session", async () => {
      const account = await signUp();
      const res = await post("/login", {
        login: account.email.toUpperCase(),
        password: PASSWORD,
      });
      assert.equal(res.status, 303);
      assert.equal(res.headers.get("location"), "/");
      const token = sessionFrom(res);
      assert.ok(token);
      assert.match(setCookieHeader(res)!, /HttpOnly/i);
      assert.equal((await get("/profile", { cookie: token })).status, 200);
    });

    test("logs in with username (any case)", async () => {
      const account = await signUp();
      const res = await post("/login", {
        login: ` ${account.username.toUpperCase()} `,
        password: PASSWORD,
      });
      assert.equal(res.status, 303);
      assert.ok(sessionFrom(res));
    });

    test("every login gets a fresh session token", async () => {
      const account = await signUp();
      const a = sessionFrom(
        await post("/login", { login: account.email, password: PASSWORD }),
      );
      const b = sessionFrom(
        await post("/login", { login: account.email, password: PASSWORD }),
      );
      assert.ok(a && b);
      assert.notEqual(a, b);
      assert.notEqual(a, account.token);
    });

    test("logging in again from the same browser replaces its old session", async () => {
      const account = await signUp();
      const res = await post(
        "/login",
        { login: account.email, password: PASSWORD },
        { cookie: account.token },
      );
      assert.equal(res.status, 303);
      // The pre-login token no longer works.
      assert.equal(
        (await get("/profile", { cookie: account.token })).status,
        302,
      );
      assert.equal(
        (await get("/profile", { cookie: sessionFrom(res) })).status,
        200,
      );
    });

    test("a wrong password and an unknown account get the same 401 response", async () => {
      const account = await signUp();
      const wrong = await post("/login", {
        login: account.email,
        password: "not the password",
      });
      const unknown = await post("/login", {
        login: `nobody_${unique()}@charlotte.edu`,
        password: PASSWORD,
      });
      for (const res of [wrong, unknown]) {
        assert.equal(res.status, 401);
        assert.equal(sessionFrom(res), undefined, "no session on failure");
        const html = decode(await res.text());
        assert.match(
          html,
          /That email\/username and password don't match an account/,
        );
        assert.doesNotMatch(
          html,
          /not the password/,
          "password is never echoed back",
        );
      }
    });

    test("missing fields return 400 with field errors", async () => {
      const res = await post("/login", { login: "", password: "" });
      assert.equal(res.status, 400);
      const html = decode(await res.text());
      assert.match(html, /Enter your email or username/);
      assert.match(html, /Enter your password/);
    });

    test("keeps what the user typed in the login box after a failure", async () => {
      const res = await post("/login", {
        login: "someone@charlotte.edu",
        password: "nope",
      });
      assert.equal(res.status, 401);
      assert.match(await res.text(), /value="someone@charlotte.edu"/);
    });

    test("redirects to ?next after login, but never off-site", async () => {
      const account = await signUp();
      const local = await post("/login", {
        login: account.email,
        password: PASSWORD,
        next: "/friends",
      });
      assert.equal(local.headers.get("location"), "/friends");
      for (const next of ["https://evil.example/", "//evil.example/"]) {
        const res = await post("/login", {
          login: account.email,
          password: PASSWORD,
          next,
        });
        assert.equal(res.status, 303);
        assert.equal(res.headers.get("location"), "/", `next=${next}`);
      }
    });

    test("logged-in users visiting /login are sent on", async () => {
      const { token } = await signUp();
      const res = await get("/login?next=%2Ffriends", { cookie: token });
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "/friends");
    });
  });

  describe("protected pages, sessions and logout", () => {
    test("logged-out visitors are sent to log in, then returned to the page they wanted", async () => {
      const res = await get("/profile");
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), "/login?next=%2Fprofile");

      const loginPage = await (await get(res.headers.get("location")!)).text();
      assert.match(loginPage, /name="next" value="\/profile"/);

      const account = await signUp();
      const login = await post("/login", {
        login: account.email,
        password: PASSWORD,
        next: "/profile",
      });
      assert.equal(login.headers.get("location"), "/profile");
      assert.equal(
        (await get("/profile", { cookie: sessionFrom(login) })).status,
        200,
      );
    });

    test("API clients asking for JSON get a 401 instead of a redirect", async () => {
      const res = await get("/friends", {
        headers: { accept: "application/json" },
      });
      assert.equal(res.status, 401);
      assert.deepEqual(await res.json(), {
        error: "You need to log in first.",
      });
    });

    test("logout ends the session, clears the cookie, and shows a notice", async () => {
      const account = await signUp();
      assert.equal(
        (await get("/profile", { cookie: account.token })).status,
        200,
      );

      const res = await post("/logout", {}, { cookie: account.token });
      assert.equal(res.status, 303);
      assert.equal(res.headers.get("location"), "/login?logged_out");
      assert.equal(sessionFrom(res), "", "cookie is cleared");
      assert.match(setCookieHeader(res)!, /Expires=Thu, 01 Jan 1970/);

      const user = await db
        .selectFrom("users")
        .select("id")
        .where("email", "=", account.email)
        .executeTakeFirstOrThrow();
      assert.deepEqual(
        await db
          .selectFrom("sessions")
          .select("token_hash")
          .where("user_id", "=", user.id)
          .execute(),
        [],
      );

      // Re-sending the old cookie (e.g. a copied token) no longer works.
      assert.equal(
        (await get("/profile", { cookie: account.token })).status,
        302,
      );

      const loginPage = decode(await (await get("/login?logged_out")).text());
      assert.match(loginPage, /You've been logged out/);
    });

    test("logout only ends that browser's session", async () => {
      const account = await signUp();
      const other = sessionFrom(
        await post("/login", { login: account.email, password: PASSWORD }),
      );
      await post("/logout", {}, { cookie: account.token });
      assert.equal((await get("/profile", { cookie: other })).status, 200);
    });

    test("logging out while logged out is harmless", async () => {
      const res = await post("/logout");
      assert.equal(res.status, 303);
      assert.equal(res.headers.get("location"), "/login?logged_out");
    });

    test("logout can't be triggered with a GET link", async () => {
      const { token } = await signUp();
      const res = await get("/logout", { cookie: token });
      assert.equal(res.status, 404);
      assert.equal(
        (await get("/profile", { cookie: token })).status,
        200,
        "still logged in",
      );
    });

    test("expired sessions are rejected, deleted, and the cookie is cleared", async () => {
      const account = await signUp();
      await db
        .updateTable("sessions")
        .set({ expires_at: new Date(Date.now() - 1000) })
        .execute();
      const res = await get("/profile", { cookie: account.token });
      assert.equal(res.status, 302);
      assert.equal(sessionFrom(res), "", "stale cookie is cleared");
      const user = await db
        .selectFrom("users")
        .select("id")
        .where("email", "=", account.email)
        .executeTakeFirstOrThrow();
      assert.deepEqual(
        await db
          .selectFrom("sessions")
          .select("token_hash")
          .where("user_id", "=", user.id)
          .execute(),
        [],
      );
    });

    test("forged or garbage cookies are treated as logged out, not as errors", async () => {
      for (const cookie of ["forged-token", "%E0%A4%A", "a".repeat(5000)]) {
        const home = await get("/", { cookie });
        assert.equal(home.status, 200, cookie.slice(0, 20));
        assert.equal((await get("/profile", { cookie })).status, 302);
      }
    });
  });

  describe("error flow", () => {
    test("cross-site form posts are blocked with 403", async () => {
      const account = await signUp();
      for (const headers of [
        { "sec-fetch-site": "cross-site" },
        { "sec-fetch-site": "same-site" },
        { origin: "https://evil.example" },
      ] as Record<string, string>[]) {
        const login = await post(
          "/login",
          { login: account.email, password: PASSWORD },
          { headers },
        );
        assert.equal(login.status, 403, JSON.stringify(headers));
        assert.equal(sessionFrom(login), undefined, "no session was started");
        assert.match(await login.text(), /Cross-site requests are not allowed/);

        const logout = await post(
          "/logout",
          {},
          { cookie: account.token, headers },
        );
        assert.equal(logout.status, 403);
      }
      assert.equal(
        (await get("/profile", { cookie: account.token })).status,
        200,
        "still logged in",
      );
    });

    test("same-origin browser posts are allowed", async () => {
      const account = await signUp();
      const host = new URL(app.baseUrl).host;
      for (const headers of [
        { "sec-fetch-site": "same-origin" },
        { origin: `http://${host}` },
      ] as Record<string, string>[]) {
        const res = await post(
          "/login",
          { login: account.email, password: PASSWORD },
          { headers },
        );
        assert.equal(res.status, 303, JSON.stringify(headers));
      }
    });

    test("blocked requests from JSON clients get a JSON error", async () => {
      const res = await post(
        "/login",
        {},
        {
          headers: {
            "sec-fetch-site": "cross-site",
            accept: "application/json",
          },
        },
      );
      assert.equal(res.status, 403);
      assert.deepEqual(await res.json(), {
        error: "Cross-site requests are not allowed.",
      });
    });

    test("without a database, pages render but account actions return 503", async (t) => {
      const noDb = await startServer();
      t.after(noDb.close);
      t.mock.method(console, "error", () => {}); // 5xx errors are logged; keep test output clean
      assert.equal((await fetch(`${noDb.baseUrl}/login`)).status, 200);
      for (const path of ["/signup", "/login"]) {
        const res = await fetch(`${noDb.baseUrl}${path}`, {
          method: "POST",
          body: new URLSearchParams({
            username: "norm_niner",
            email: "norm@charlotte.edu",
            login: "norm@charlotte.edu",
            password: PASSWORD,
            confirmPassword: PASSWORD,
          }),
        });
        assert.equal(res.status, 503, path);
        assert.match(decode(await res.text()), /database isn't connected/);
      }
    });

    test("database failures become a 500 page that hides internal details in production", async (t) => {
      const failing = {
        selectFrom() {
          throw new Error("connect ECONNREFUSED secret-db-host:5432");
        },
      };
      const broken = await startServer({
        db: failing as unknown as ReturnType<typeof createTestDatabase>,
      });
      t.after(broken.close);
      const logged = [];
      t.mock.method(console, "error", (err: unknown) => logged.push(err));
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      t.after(() => {
        if (previous === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previous;
      });

      const res = await fetch(`${broken.baseUrl}/login`, {
        method: "POST",
        body: new URLSearchParams({
          login: "norm@charlotte.edu",
          password: PASSWORD,
        }),
      });
      assert.equal(res.status, 500);
      const html = await res.text();
      assert.match(html, /Something went wrong/);
      assert.doesNotMatch(html, /secret-db-host/);
      assert.equal(
        logged.length,
        1,
        "the real error is still logged for developers",
      );
    });
  });
});
