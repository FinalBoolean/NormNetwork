export interface SessionUser {
  id: number;
  username: string;
  email: string;
}

export interface PageProps {
  page: string;

  title: string;

  currentPath?: string;

  currentUser?: SessionUser | null;

  values?: Record<string, string>;

  errors?: Record<string, string>;

  next?: string;

  notice?: string;

  description?: string;

  status?: number;

  message?: string;
}

function AuthForm({ page, values = {}, errors = {}, next, notice }: PageProps) {
  const signup = page === "signup";

  const fields = signup
    ? [
        ["username", "Username", "text", "username"],
        ["email", "UNC Charlotte email", "email", "email"],
        ["password", "Password", "password", "new-password"],
        ["confirmPassword", "Confirm password", "password", "new-password"],
      ]
    : [
        ["login", "Email or username", "text", "username"],
        ["password", "Password", "password", "current-password"],
      ];

  return (
    <section className="panel auth-panel">
      <h1>{signup ? "Create your account" : "Log in"}</h1>

      <p className="lede">
        {signup
          ? "Sign up with your UNC Charlotte email."
          : "Welcome back to Norm's Network."}
      </p>

      {notice && (
        <div className="alert alert-info" role="status">
          {notice}
        </div>
      )}

      {!!Object.keys(errors).length && (
        <div className="alert alert-error" role="alert">
          {errors.form || "Please fix the highlighted fields."}
        </div>
      )}

      <form
        className="form"
        method="post"
        action={signup ? "/signup" : "/login"}
        noValidate
      >
        {next && <input type="hidden" name="next" value={next} />}

        {fields.map(([name, label, type, autoComplete]) => (
          <div
            key={name}
            className={`field${errors[name] ? " has-error" : ""}`}
          >
            <label htmlFor={name}>{label}</label>

            <input
              id={name}
              name={name}
              type={type}
              autoComplete={autoComplete}
              required

              defaultValue={
                type === "password" ? undefined : values[name] || ""
              }

              minLength={
                name === "username"
                  ? 3
                  : signup && name === "password"
                    ? 8
                    : undefined
              }

              maxLength={
                name === "username"
                  ? 30
                  : name === "email"
                    ? 255
                    : type === "password"
                      ? 128
                      : undefined
              }

              aria-invalid={errors[name] ? true : undefined}

              aria-describedby={
                errors[name]
                  ? `${name}-error`
                  : signup && name === "password"
                    ? "password-hint"
                    : undefined
              }
            />

            {errors[name] && (
              <p className="field-error" id={`${name}-error`}>
                {errors[name]}
              </p>
            )}

            {signup && name === "password" && !errors.password && (
              <p className="field-hint" id="password-hint">
                At least 8 characters.
              </p>
            )}
          </div>
        ))}

        <button className="btn" type="submit">
          {signup ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="form-footer">
        {signup ? "Already have an account? " : "New here? "}
        <a
          href={`${signup ? "/login" : "/signup"}${next ? `?next=${encodeURIComponent(next)}` : ""}`}
        >
          {signup ? "Log in" : "Create an account"}
        </a>
      </p>
    </section>
  );
}

export default function App(props: PageProps) {
  const { page, currentUser: user, currentPath = "" } = props;

  return (
    <>
      <header className="site-header">
        <nav className="container nav" aria-label="Main navigation">
          <a className="brand" href="/">
            <span className="brand-mark">NN</span> Norm's Network
          </a>

          <ul className="nav-links">
            {[
              ["/finder", "Finder"],
              ["/threads", "Threads"],
              ["/friends", "Friends"],
              ["/profile", "Profile"],
            ].map(([href, label]) => (
              <li key={href}>
                <a
                  href={href}
                  className={currentPath.startsWith(href) ? "active" : ""}
                >
                  {label}
                </a>
              </li>
            ))}

            {user ? (
              <>
                <li className="nav-user">@{user.username}</li>
                <li>
                  <form method="post" action="/logout" className="nav-logout">
                    <button className="btn btn-small" type="submit">
                      Log out
                    </button>
                  </form>
                </li>
              </>
            ) : (
              <>
                <li>
                  <a href="/signup">Sign up</a>
                </li>
                <li>
                  <a className="btn btn-small" href="/login">
                    Log in
                  </a>
                </li>
              </>
            )}
          </ul>
        </nav>
      </header>

      <main className="container">
        {page === "home" ? (
          <>
            <section className="hero">
              <h1>
                {user
                  ? `Welcome back, ${user.username}.`
                  : "Find your people at Charlotte."}
              </h1>

              <p className="lede">
                {user
                  ? "Pick up where you left off: find people, or jump into a thread."
                  : "Norm's Network helps Niners meet friends, form study groups, and squad up for games."}
              </p>

              <div className="actions">
                <a className="btn" href={user ? "/profile" : "/signup"}>
                  {user ? "Your profile" : "Create an account"}
                </a>
                <a className="btn btn-ghost" href="/threads">
                  Browse threads
                </a>
              </div>
            </section>

            <section className="cards">
              {[
                [
                  "/finder/friends",
                  "Friend Finder",
                  "Match with students who share your interests.",
                ],

                [
                  "/finder/study",
                  "Study Finder",
                  "Find a study partner for ITSC 3155 or any other course.",
                ],

                [
                  "/finder/gaming",
                  "Gaming Finder",
                  "Find teammates by game, rank, and main role.",
                ],

                [
                  "/threads",
                  "Threads",
                  "Ask questions, share events, and join the conversation.",
                ],
              ].map(([href, title, description]) => (
                <a className="card" href={href} key={href}>
                  <h2>{title}</h2>
                  <p>{description}</p>
                </a>
              ))}
            </section>
          </>
        ) : page === "signup" || page === "login" ? (
          <AuthForm {...props} />
        ) : page === "error" ? (
          <section className="panel">
            <p className="status-code">{props.status}</p>
            <h1>
              {props.status === 404 ? "Page not found" : "Something went wrong"}
            </h1>
            <p className="lede">{props.message}</p>
            <a className="btn" href="/">
              Back to home
            </a>
          </section>
        ) : (
          <section className="panel">
            <span className="badge">Coming soon</span>
            <h1>{props.title}</h1>
            <p className="lede">{props.description}</p>
            <a className="btn btn-ghost" href="/">
              Back to home
            </a>
          </section>
        )}
      </main>

      <footer className="site-footer">
        <div className="container">
          Norm's Network · ITSC 3155 final project
        </div>
      </footer>
    </>
  );
}
