import type { Profile } from "./profile.js";
import type { CompanionType } from "./companions.js";
import { useState } from "react";
import FriendFinderPage from "./FriendFinder.js";
import StudyFinderPage from "./StudyFinder.js";
import GamingFinderPage from "./GamingFinder.js";
import ProfilePageView from "./ProfilePage.js";
import ThreadsPageView from "./ThreadsPage.js";
import FriendsPageView from "./FriendsPage.js";
import HomePage from "./HomePage.js";
import ErrorPage from "./ErrorPage.js";
import { CompanionTypesPage } from "./CompanionPages.js";

export interface SessionUser {
  id: number;
  username: string;
  email: string;
}

export interface PageProps {
  profile?: Profile | null;
  editingProfile?: boolean;
  companionTypes?: CompanionType[];
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

const JOIN_FEATURES = [
  {
    icon: "/assets/join/feature-friends.svg",
    title: "Real friends",
    body: "Find new faces with the same Niner spirit.",
  },
  {
    icon: "/assets/join/feature-study.svg",
    title: "Study buddies",
    body: "Meet someone who gets your course load.",
  },
  {
    icon: "/assets/join/feature-gaming.svg",
    title: "Your next duo",
    body: "Good comms. Better company. Niners only.",
  },
] as const;

function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span
      className="join-brand-emblem"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <img
        src="/assets/join/brand-network.svg"
        alt=""
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
      />
    </span>
  );
}

function JoinNav({
  signup,
  next,
}: {
  signup: boolean;
  next?: string;
}) {
  const loginHref = `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const signupHref = `/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <header className="join-nav">
      <a className="join-brand" href="/">
        <BrandMark />
        <span>norm’s network</span>
      </a>

      <div className="join-nav-signin">
        {signup ? (
          <>
            <span className="join-nav-prompt">Already found your way here?</span>
            <a className="join-btn join-btn-secondary" href={loginHref}>
              Log in
            </a>
          </>
        ) : (
          <>
            <span className="join-nav-prompt">New to campus?</span>
            <a className="join-btn join-btn-secondary" href={signupHref}>
              Sign up
            </a>
          </>
        )}
      </div>
    </header>
  );
}

function CampusInvite() {
  return (
    <aside className="join-invite" aria-label="About Norm's Network">
      <div className="join-motto">
        <span className="join-accent-line" aria-hidden="true" />
        <p>YOUR CAMPUS. YOUR PEOPLE.</p>
      </div>

      <h1 className="join-invite-title">
        College is better
        <br />
        with your people.
      </h1>

      <p className="join-invite-lede">
        Study buddies. Teammates. Real friends.
        <br />
        One network, just for UNC Charlotte.
      </p>

      <ul className="join-features">
        {JOIN_FEATURES.map((feature) => (
          <li key={feature.title} className="join-feature">
            <span className="join-feature-emblem" aria-hidden="true">
              <img src={feature.icon} alt="" width={24} height={24} />
            </span>
            <div>
              <p className="join-feature-title">{feature.title}</p>
              <p className="join-feature-body">{feature.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="join-assurance">
        <img
          src="/assets/join/shield.svg"
          alt=""
          width={24}
          height={24}
          aria-hidden="true"
        />
        Real students. No dating pressure.
      </p>
    </aside>
  );
}

function AuthForm({ page, values = {}, errors = {}, next, notice }: PageProps) {
  const signup = page === "signup";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const altHref = `${signup ? "/login" : "/signup"}${
    next ? `?next=${encodeURIComponent(next)}` : ""
  }`;

  return (
    <section className="join-form-panel">
      <div className="join-step-row">
        <h1>{signup ? "Become a Niner insider" : "Welcome back"}</h1>
        {signup && <p className="join-step">01 / 02</p>}
      </div>

      {signup && (
        <div className="join-progress" aria-hidden="true">
          <span className="join-progress-active" />
          <span className="join-progress-idle" />
        </div>
      )}

      {!signup && (
        <p className="join-form-lede">Log in to Norm’s Network with your account.</p>
      )}

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
        className="join-form"
        method="post"
        action={signup ? "/signup" : "/login"}
        noValidate
      >
        {next && <input type="hidden" name="next" value={next} />}

        {signup ? (
          <>
            <div className={`join-field${errors.username ? " has-error" : ""}`}>
              <label htmlFor="username">Unique username</label>
              <div className="join-input-wrap">
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  defaultValue={values.username || ""}
                  minLength={3}
                  maxLength={30}
                  aria-invalid={errors.username ? true : undefined}
                  aria-describedby={
                    errors.username ? "username-error" : undefined
                  }
                />
              </div>
              {errors.username && (
                <p className="field-error" id="username-error">
                  {errors.username}
                </p>
              )}
            </div>

            <div className={`join-field${errors.email ? " has-error" : ""}`}>
              <label htmlFor="email">UNC Charlotte email</label>
              <div className="join-input-wrap">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue={values.email || ""}
                  maxLength={255}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                <img
                  className="join-input-icon"
                  src="/assets/join/mail.svg"
                  alt=""
                  width={20}
                  height={20}
                  aria-hidden="true"
                />
              </div>
              {errors.email && (
                <p className="field-error" id="email-error">
                  {errors.email}
                </p>
              )}
            </div>

            <div className={`join-field${errors.password ? " has-error" : ""}`}>
              <label htmlFor="password">Secure password</label>
              <div className="join-input-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={
                    errors.password ? "password-error" : "password-hint"
                  }
                />
                <button
                  type="button"
                  className="join-input-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <img
                    src="/assets/join/eye-off.svg"
                    alt=""
                    width={20}
                    height={20}
                  />
                </button>
              </div>
              {errors.password ? (
                <p className="field-error" id="password-error">
                  {errors.password}
                </p>
              ) : (
                <p className="join-field-ok" id="password-hint">
                  ✓&nbsp;&nbsp;8+ characters
                </p>
              )}
            </div>

            <div
              className={`join-field${errors.confirmPassword ? " has-error" : ""}`}
            >
              <label htmlFor="confirmPassword">Confirm password</label>
              <div className="join-input-wrap">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  maxLength={128}
                  aria-invalid={errors.confirmPassword ? true : undefined}
                  aria-describedby={
                    errors.confirmPassword
                      ? "confirmPassword-error"
                      : undefined
                  }
                />
                <button
                  type="button"
                  className="join-input-toggle"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={
                    showConfirm ? "Hide confirm password" : "Show confirm password"
                  }
                >
                  <img
                    src="/assets/join/eye-off.svg"
                    alt=""
                    width={20}
                    height={20}
                  />
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="field-error" id="confirmPassword-error">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <div className="join-campus-note">
              <div className="join-campus-note-head">
                <img
                  src="/assets/join/shield-check.svg"
                  alt=""
                  width={22}
                  height={22}
                  aria-hidden="true"
                />
                <p>Campus email required</p>
                <img
                  className="join-campus-note-check"
                  src="/assets/join/circle-check.svg"
                  alt=""
                  width={20}
                  height={20}
                  aria-hidden="true"
                />
              </div>
              <p className="join-campus-note-body">
                Use your @charlotte.edu or @uncc.edu address — only Charlotte
                students can join.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className={`join-field${errors.login ? " has-error" : ""}`}>
              <label htmlFor="login">Email or username</label>
              <div className="join-input-wrap">
                <input
                  id="login"
                  name="login"
                  type="text"
                  autoComplete="username"
                  required
                  defaultValue={values.login || ""}
                  aria-invalid={errors.login ? true : undefined}
                  aria-describedby={errors.login ? "login-error" : undefined}
                />
              </div>
              {errors.login && (
                <p className="field-error" id="login-error">
                  {errors.login}
                </p>
              )}
            </div>

            <div className={`join-field${errors.password ? " has-error" : ""}`}>
              <label htmlFor="password">Password</label>
              <div className="join-input-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                />
                <button
                  type="button"
                  className="join-input-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <img
                    src="/assets/join/eye-off.svg"
                    alt=""
                    width={20}
                    height={20}
                  />
                </button>
              </div>
              {errors.password && (
                <p className="field-error" id="password-error">
                  {errors.password}
                </p>
              )}
            </div>
          </>
        )}

        <button className="join-btn join-btn-primary" type="submit">
          {signup && (
            <img
              src="/assets/join/arrow-right.svg"
              alt=""
              width={20}
              height={20}
              aria-hidden="true"
            />
          )}
          {signup ? "Create my account" : "Log in"}
        </button>
      </form>

      {signup && (
        <p className="join-legal">
          By joining, you agree to our Community Guidelines, Terms of Service
          and Privacy Policy.
        </p>
      )}

      <p className="join-form-footer">
        {signup ? "Already found your way here?" : "New here?"}{" "}
        <a href={altHref}>{signup ? "Log in" : "Create an account"}</a>
      </p>
    </section>
  );
}

function JoinAuthPage(props: PageProps) {
  const signup = props.page === "signup";

  return (
    <div className={`join-page${signup ? " join-page-signup" : " join-page-login"}`}>
      <JoinNav signup={signup} next={props.next} />
      <div className="join-workspace">
        {signup && <CampusInvite />}
        <AuthForm {...props} />
      </div>
    </div>
  );
}

export default function App(props: PageProps) {
  const { page, currentUser: user, currentPath = "" } = props;

  if (page === "signup" || page === "login") {
    return <JoinAuthPage {...props} />;
  }

  // Figma landing (Join Norm's Network) is the logged-out home.
  if (page === "home" && !user) {
    return <JoinAuthPage {...props} page="signup" />;
  }

  if (page === "home" && user) {
    return <HomePage {...props} />;
  }

  if (page === "friend_finder") {
    return <FriendFinderPage {...props} />;
  }

  if (page === "study_finder") {
    return <StudyFinderPage {...props} />;
  }

  if (page === "gaming_finder") {
    return <GamingFinderPage {...props} />;
  }

  if (page === "profile") {
    return <ProfilePageView {...props} />;
  }

  if (page === "companions") {
    return <CompanionTypesPage {...props} />;
  }

  if (page === "threads") {
    return <ThreadsPageView {...props} />;
  }

  if (page === "friends") {
    return <FriendsPageView {...props} />;
  }

  if (page === "error") {
    return <ErrorPage status={props.status} message={props.message} />;
  }

  // Fallback for any leftover placeholder pages — keep the Join theme.
  return (
    <div className="join-page error-page">
      <header className="join-nav">
        <a className="join-brand" href="/">
          <span className="join-brand-emblem" aria-hidden="true">
            <img
              src="/assets/join/brand-network.svg"
              alt=""
              width={25}
              height={25}
            />
          </span>
          <span>norm’s network</span>
        </a>
        <a className="join-btn join-btn-secondary" href="/">
          Back to home
        </a>
      </header>
      <main className="error-workspace">
        <section className="error-card">
          <span className="error-badge">Coming soon</span>
          <h1>{props.title}</h1>
          <p className="error-message">{props.description}</p>
          <a className="join-btn join-btn-primary error-action-btn" href="/">
            Back to home
          </a>
        </section>
      </main>
    </div>
  );
}
