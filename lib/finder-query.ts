// Helpers shared by the finder queries (lib/study-finder.ts, lib/gaming-finder.ts).

/** Lists (courses, games, platforms) are stored as one string: "PC, Xbox". */
export const LIST_SEPARATOR = ", ";

/** Escapes % and _ so search text is matched literally by ILIKE. */
export const likePattern = (text: string) =>
  `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
