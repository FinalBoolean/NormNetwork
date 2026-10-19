/**
 * Throw this from a route to send a specific status code:
 *   throw new HttpError(403, "You can only edit your own profile.");
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function notFound(req, res) {
  res.status(404).render("pages/error", {
    title: "Page not found",
    status: 404,
    message: `We couldn't find ${req.path}.`,
  });
}

// Express 5 sends errors thrown in async route handlers here automatically.
// Keep all 4 parameters: Express recognizes error handlers by their 4 arguments.
export function errorHandler(err, req, res, next) {
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) console.error(err);

  // Hide internal error details from users in production
  const message =
    status < 500 || process.env.NODE_ENV !== "production"
      ? err.message
      : "Something went wrong.";

  if (req.accepts(["html", "json"]) === "json") {
    res.status(status).json({ error: message });
  } else {
    res.status(status).render("pages/error", { title: "Error", status, message });
  }
}
