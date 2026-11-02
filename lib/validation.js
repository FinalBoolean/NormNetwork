// Sign-up is limited to UNC Charlotte addresses. Override with a comma-separated
// list, e.g. ALLOWED_EMAIL_DOMAINS=charlotte.edu,example.test for local testing.
export function allowedEmailDomains() {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "charlotte.edu,uncc.edu")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export const USERNAME_PATTERN = /^[A-Za-z0-9_.]{3,30}$/;
export const PASSWORD_MIN = 8;
// Upper bound keeps hashing time predictable for absurdly long inputs.
export const PASSWORD_MAX = 128;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const str = (value) => (typeof value === "string" ? value : "");

/**
 * Validate a sign-up form body.
 * @returns {{ values: {username: string, email: string, password: string}, errors: Record<string, string> }}
 *   `errors` is empty when the input is valid. Keys match form field names.
 */
export function validateSignup(body = {}) {
  const username = str(body.username).trim();
  const email = str(body.email).trim().toLowerCase();
  const password = str(body.password);
  const confirm = str(body.confirmPassword);
  const errors = {};

  if (!username) errors.username = "Choose a username.";
  else if (!USERNAME_PATTERN.test(username))
    errors.username = "Usernames are 3–30 characters: letters, numbers, underscores and periods.";

  const domains = allowedEmailDomains();
  if (!email) errors.email = "Enter your UNC Charlotte email.";
  else if (email.length > 255 || !EMAIL_PATTERN.test(email))
    errors.email = "Enter a valid email address.";
  else if (!domains.includes(email.split("@").pop()))
    errors.email = `Use your UNC Charlotte email (${domains.map((d) => "@" + d).join(" or ")}).`;

  if (!password) errors.password = "Choose a password.";
  else if (password.length < PASSWORD_MIN)
    errors.password = `Passwords must be at least ${PASSWORD_MIN} characters.`;
  else if (password.length > PASSWORD_MAX)
    errors.password = `Passwords can be at most ${PASSWORD_MAX} characters.`;

  if (!errors.password && password !== confirm)
    errors.confirmPassword = "Passwords don't match.";

  return { values: { username, email, password }, errors };
}

/** Validate a login form body. `login` is an email or a username. */
export function validateLogin(body = {}) {
  const login = str(body.login).trim();
  const password = str(body.password);
  const errors = {};
  if (!login) errors.login = "Enter your email or username.";
  if (!password) errors.password = "Enter your password.";
  return { values: { login, password }, errors };
}

/**
 * Only allow redirects back to a path on this site, so /login?next=https://evil.example
 * can't be used to bounce users to another website after they log in.
 */
export function safeRedirect(next, fallback = "/") {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
