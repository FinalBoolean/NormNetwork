// Shared by the browser and the server: what the Gaming Partner Finder shows.

/** Gaming partners shown per page. */
export const GAMING_FINDER_PAGE_SIZE = 10;
/** Longest search text accepted in ?q=. */
export const GAMING_SEARCH_MAX = 100;

/**
 * One student on the Gaming Partner Finder. Only details students chose to
 * share for gaming are included: no email, age, or gender.
 */
export interface GamingMatch {
  user_id: number;
  username: string;
  class: string;
  major: string;
  bio: string | null;
  /** Every game on their gaming partner profile, as they typed it */
  games: string[];
  /** Their games that the looking student also plays (any letter case) */
  shared_games: string[];
  platforms: string[];
  /** Their platforms that the looking student also plays on */
  shared_platforms: string[];
  /** null means unranked */
  rank: string | null;
  main_role: string | null;
  main_character: string | null;
  play_style: string | null;
  voice_chat: string | null;
  availability: string | null;
  /** URL of their profile photo, or null if they haven't uploaded one */
  photo: string | null;
}

export interface GamingFinderData {
  matches: GamingMatch[];
  /** Search text from ?q= */
  q: string;
  /** Game filter from ?game= */
  game: string;
  /** Platform filter from ?platform=, one of PLATFORMS */
  platform: string;
  page: number;
  hasMore: boolean;
  /** The looking student's own games and platforms, used as quick filters */
  myGames: string[];
  myPlatforms: string[];
  /** Whether other students can find the looking student here */
  discoverable: boolean;
}

/** Link to the Gaming Partner Finder with the given filters. */
export function gamingFinderHref({
  q = "",
  game = "",
  platform = "",
  page = 1,
}: {
  q?: string;
  game?: string;
  platform?: string;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (game) params.set("game", game);
  if (platform) params.set("platform", platform);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/finder/gaming?${query}` : "/finder/gaming";
}
