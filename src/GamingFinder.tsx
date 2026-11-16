import {
  BottomNav,
  FinderHeading,
  FinderSidebar,
  ModeTabs,
  TopNav,
  type SessionUser,
} from "./AppShell.js";
import { PLATFORMS } from "./companions.js";
import {
  GAMING_SEARCH_MAX,
  gamingFinderHref,
  type GamingFinderData,
  type GamingMatch,
} from "./gaming-finder.js";

type GamingFinderProps = {
  currentUser?: SessionUser | null;
  currentPath?: string;
  gamingFinder?: GamingFinderData;
  errors?: Record<string, string>;
};

const NO_RESULTS: GamingFinderData = {
  matches: [],
  q: "",
  game: "",
  platform: "",
  page: 1,
  hasMore: false,
  myGames: [],
  myPlatforms: [],
  discoverable: false,
};

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

function Icon({ src, size = 16 }: { src: string; size?: number }) {
  return <img src={src} alt="" width={size} height={size} aria-hidden="true" />;
}

function Tags({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="finder-bond">
      <p className="finder-bond-label">{label}</p>
      <div className="finder-interest-row">
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

function GamingPartnerCard({ match }: { match: GamingMatch }) {
  const sharedGames = match.shared_games;
  const otherGames = match.games.filter((game) => !sharedGames.includes(game));
  const plays = [match.main_role, match.main_character, match.play_style].filter(
    (item): item is string => Boolean(item),
  );
  const comms = [match.voice_chat, match.availability]
    .filter(Boolean)
    .join(" · ");
  const headingId = `gaming-partner-${match.user_id}`;

  return (
    <article className="match-card" aria-labelledby={headingId}>
      <div className="match-photo">
        {match.photo ? (
          <img
            src={match.photo}
            alt={`${match.username}'s profile photo`}
            className="finder-card-img"
            loading="lazy"
          />
        ) : (
          <span className="match-initials" aria-hidden="true">
            {match.username.slice(0, 2).toUpperCase()}
          </span>
        )}
        {sharedGames.length > 0 ? (
          <p className="finder-shared-pill">
            <Icon src="/assets/finder/sparkles-card.svg" size={15} />
            {`${plural(sharedGames.length, "game")} in common`}
          </p>
        ) : (
          match.shared_platforms.length > 0 && (
            <p className="finder-shared-pill">
              <Icon src="/assets/finder/sparkles-card.svg" size={15} />
              {`Also on ${match.shared_platforms.join(" & ")}`}
            </p>
          )
        )}
      </div>

      <div className="match-body">
        <div className="match-info">
          <div className="finder-identity">
            <h2 id={headingId}>{match.username}</h2>
            <p>
              {match.class} · {match.major}
            </p>
          </div>
          {match.bio && <p className="finder-bio">“{match.bio}”</p>}

          <ul className="match-stats">
            <li>
              <span className="match-stat-icon">
                <Icon src="/assets/gaming/rank.svg" size={18} />
              </span>
              <span>
                <span className="match-stat-label">RANK</span>
                <span className="match-stat-value">{match.rank ?? "Unranked"}</span>
              </span>
            </li>
            <li>
              <span className="match-stat-icon">
                <Icon src="/assets/gaming/headset.svg" size={24} />
              </span>
              <span>
                <span className="match-stat-label">COMMS</span>
                <span className="match-stat-value">{comms || "Not set"}</span>
              </span>
            </li>
          </ul>

          <Tags
            label={sharedGames.length ? "YOU BOTH PLAY" : "GAMES"}
            items={sharedGames.length ? sharedGames : otherGames}
          />
          {sharedGames.length > 0 && <Tags label="ALSO PLAYS" items={otherGames} />}
          <Tags label="PLAYS AS" items={plays} />
          <Tags label="PLATFORMS" items={match.platforms} />
        </div>

        <div className="match-actions">
          <p className="finder-note">
            <Icon src="/assets/finder/shield-note.svg" />
            Good vibes only. Be a teammate you’d want to play with.
          </p>
        </div>
      </div>
    </article>
  );
}

export default function GamingFinderPage({
  currentUser: user,
  currentPath = "",
  gamingFinder = NO_RESULTS,
  errors = {},
}: GamingFinderProps) {
  const { matches, q, game, platform, page, hasMore, myGames, discoverable } =
    gamingFinder;
  const filtered = Boolean(q || game || platform);
  const gameChips =
    game && !myGames.some((name) => name.toLowerCase() === game.toLowerCase())
      ? [...myGames, game]
      : myGames;
  const isGame = (name: string) => name.toLowerCase() === game.toLowerCase();

  return (
    <div className="app-shell finder-page">
      <TopNav user={user} currentPath={currentPath} />

      <div className="finder-workspace">
        <FinderSidebar mode="gaming" />

        <main className="finder-main">
          <FinderHeading
            eyebrow="GAMING FINDER"
            title="Find your next duo."
            subhead="Good comms. Better company. Niners only."
          />

          <ModeTabs mode="gaming" />

          {!discoverable && (
            <div className="alert alert-info" role="status">
              Other students can't find you here yet.{" "}
              <a href="/profile/gaming">Set up your gaming partner profile</a> to
              add your games and appear in the Gaming Partner Finder.
            </div>
          )}

          {(errors.game || errors.platform) && (
            <div className="alert alert-error" role="alert">
              {errors.game || errors.platform}
            </div>
          )}

          <form
            className="finder-search"
            method="get"
            action="/finder/gaming"
            role="search"
          >
            {game && <input type="hidden" name="game" value={game} />}
            {platform && <input type="hidden" name="platform" value={platform} />}
            <label htmlFor="gaming-search" className="sr-only">
              Search gaming partners
            </label>
            <input
              id="gaming-search"
              name="q"
              type="search"
              defaultValue={q}
              maxLength={GAMING_SEARCH_MAX}
              placeholder="Game, role, rank, or major"
            />
            <button type="submit" className="finder-btn finder-btn-primary">
              Search
            </button>
          </form>

          <nav className="finder-filters" aria-label="Filter by game">
            <div className="finder-filter-chips">
              <a
                className={`finder-chip${game ? "" : " is-active"}`}
                href={gamingFinderHref({ q, platform })}
                aria-current={game ? undefined : "true"}
              >
                All games
              </a>
              {gameChips.map((name) => (
                <a
                  key={name}
                  className={`finder-chip${isGame(name) ? " is-active" : ""}`}
                  href={gamingFinderHref({ q, game: name, platform })}
                  aria-current={isGame(name) ? "true" : undefined}
                >
                  {name}
                </a>
              ))}
            </div>
            {filtered && (
              <a className="finder-all-filters" href="/finder/gaming">
                Clear filters
              </a>
            )}
          </nav>

          <nav className="finder-filters" aria-label="Filter by platform">
            <div className="finder-filter-chips">
              <a
                className={`finder-chip${platform ? "" : " is-active"}`}
                href={gamingFinderHref({ q, game })}
                aria-current={platform ? undefined : "true"}
              >
                Any platform
              </a>
              {PLATFORMS.map((name) => (
                <a
                  key={name}
                  className={`finder-chip${platform === name ? " is-active" : ""}`}
                  href={gamingFinderHref({ q, game, platform: name })}
                  aria-current={platform === name ? "true" : undefined}
                >
                  {name}
                </a>
              ))}
            </div>
          </nav>

          {matches.length ? (
            <div className="match-list">
              {matches.map((match) => (
                <GamingPartnerCard key={match.user_id} match={match} />
              ))}
            </div>
          ) : (
            <section className="match-empty">
              <h2>No gaming partners found</h2>
              <p>
                {filtered
                  ? "No one matches those filters yet. Try another game, platform, or search."
                  : "No other students have shared a gaming partner profile yet. Check back soon."}
              </p>
              {filtered && (
                <a className="finder-btn finder-btn-secondary" href="/finder/gaming">
                  See everyone
                </a>
              )}
            </section>
          )}

          {(page > 1 || hasMore) && (
            <nav className="match-pages" aria-label="More gaming partners">
              {page > 1 && (
                <a
                  className="match-more"
                  href={gamingFinderHref({ q, game, platform, page: page - 1 })}
                >
                  Previous
                </a>
              )}
              {hasMore && (
                <a
                  className="match-more"
                  href={gamingFinderHref({ q, game, platform, page: page + 1 })}
                >
                  See more gaming partners
                  <Icon src="/assets/study/chevron.svg" size={18} />
                </a>
              )}
            </nav>
          )}
        </main>
      </div>

      <BottomNav currentPath={currentPath} />
    </div>
  );
}
