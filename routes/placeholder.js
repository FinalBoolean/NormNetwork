/**
 * Temporary "coming soon" page for features that aren't built yet.
 * Replace each use with a real route handler as the feature is implemented.
 *
 * @param {string} title
 * @param {string} description
 * @param {string[]} [tables] Database tables the feature will use (shown as a dev note)
 */
export function placeholder(title, description, tables = []) {
  return (req, res) => {
    res.render("pages/placeholder", { title, description, tables });
  };
}
