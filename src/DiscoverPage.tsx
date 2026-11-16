import { useState } from "react";
import {
  BottomNav,
  FinderSidebar,
  ModeTabs,
  TopNav,
  type SessionUser,
} from "./AppShell.js";
import type { DiscoveryData, DiscoveryPerson } from "./discovery.js";

type DiscoverPageProps = {
  currentUser?: SessionUser | null;
  currentPath?: string;
  discovery?: DiscoveryData;
};

export function PersonAvatar({
  person,
  className = "friend-avatar",
}: {
  person: DiscoveryPerson;
  className?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return person.profilePicture && failedSource !== person.profilePicture ? (
    <img
      className={className}
      src={person.profilePicture}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedSource(person.profilePicture)}
    />
  ) : (
    <span className={`${className} person-avatar-placeholder`} aria-hidden="true">
      {person.username.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function ConnectionActions({
  person,
  hasProfile,
  returnTo,
}: {
  person: DiscoveryPerson;
  hasProfile: boolean;
  returnTo: string;
}) {
  if (!hasProfile) {
    return <a className="finder-btn finder-btn-secondary" href="/profile">Create profile to connect</a>;
  }
  if (person.connection === "friends") {
    return <span className="friend-pending">Connected</span>;
  }
  if (person.connection === "sent") {
    return <span className="friend-pending">Request sent</span>;
  }
  if (person.connection === "incoming" && person.requestId !== null) {
    return (
      <div className="connection-request-actions">
        <p className="connection-request-label">Wants to connect with you</p>
        <div className="friend-actions">
          {(["accept", "decline"] as const).map((action) => (
            <form key={action} method="post" action={`/friends/requests/${person.requestId}/${action}`}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <button
                type="submit"
                className={`finder-btn finder-btn-${action === "accept" ? "primary" : "secondary"}`}
                aria-label={`${action === "accept" ? "Accept" : "Decline"} request from ${person.username}`}
              >
                {action === "accept" ? "Accept" : "Decline"}
              </button>
            </form>
          ))}
        </div>
      </div>
    );
  }
  return (
    <form method="post" action="/friends/requests">
      <input type="hidden" name="receiver_id" value={person.profileId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit" className="finder-btn finder-btn-primary" aria-label={`Connect with ${person.username}`}>
        Connect
      </button>
    </form>
  );
}

function discoveryHref(query: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  return `/discover${params.size ? `?${params}` : ""}`;
}

export default function DiscoverPage({
  currentUser: user,
  currentPath = "/discover",
  discovery = { people: [], query: "", page: 1, hasNext: false, hasProfile: false },
}: DiscoverPageProps) {
  const { people, query, page, hasNext, hasProfile } = discovery;
  const returnTo = discoveryHref(query, page);

  return (
    <div className="app-shell finder-page discovery-page">
      <TopNav user={user} currentPath={currentPath} />
      <div className="finder-workspace">
        <FinderSidebar mode="discover" />
        <main className="finder-main discovery-main">
          <header className="finder-heading">
            <p className="finder-eyebrow">YOUR CAMPUS. YOUR PEOPLE.</p>
            <h1>Discover students</h1>
            <p className="finder-subhead">Meet someone new. Find a familiar interest. Start with a connection.</p>
          </header>
          <ModeTabs mode="discover" />

          {!hasProfile && (
            <div className="discovery-profile-prompt">
              <div>
                <h2>Let people get to know you.</h2>
                <p>Create your profile to send and accept connection requests.</p>
              </div>
              <a className="finder-btn finder-btn-primary" href="/profile">Create your profile</a>
            </div>
          )}

          <form className="discovery-search" method="get" action="/discover" role="search">
            <label htmlFor="discover-search">Search students</label>
            <div className="discovery-search-controls">
              <input
                id="discover-search"
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Username, major, or something in their bio"
                maxLength={100}
              />
              <button className="finder-btn finder-btn-primary" type="submit">Search</button>
              {query && <a className="discovery-clear" href="/discover">Clear</a>}
            </div>
          </form>

          <div className="discovery-results-heading">
            <h2>{query ? `Results for “${query}”` : "Around campus"}</h2>
            <a href="/friends">Your connections →</a>
          </div>

          {people.length ? (
            <div className="discovery-grid">
              {people.map((person) => (
                <article className="discovery-card" key={person.profileId} aria-labelledby={`student-${person.profileId}`}>
                  <div className="discovery-identity">
                    <PersonAvatar person={person} className="discovery-avatar" />
                    <div>
                      <h3 id={`student-${person.profileId}`}>{person.username}</h3>
                      <p>{person.class} · {person.age}</p>
                    </div>
                  </div>
                  <p className="discovery-major">{person.major}</p>
                  <p className="discovery-bio">{person.bio || "Still finding the words. Say hello with a connection request."}</p>
                  <div className="discovery-card-actions">
                    <ConnectionActions person={person} hasProfile={hasProfile} returnTo={returnTo} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <section className="discovery-empty" aria-label="No students found">
              <h2>{query ? "No students match your search." : page > 1 ? "You’ve reached the end." : "Your campus circle starts here."}</h2>
              <p>{query ? "Try another username, major, or interest." : page > 1 ? "Head back to see more students." : "When other students create their profiles, you’ll find them here."}</p>
              {(query || page > 1) && <a className="finder-btn finder-btn-secondary" href="/discover">Browse all students</a>}
            </section>
          )}

          {(page > 1 || hasNext) && (
            <nav className="discovery-pagination" aria-label="Discovery pages">
              {page > 1 && <a className="finder-btn finder-btn-secondary" href={discoveryHref(query, page - 1)}>Previous</a>}
              <span>Page {page}</span>
              {hasNext && <a className="finder-btn finder-btn-secondary" href={discoveryHref(query, page + 1)}>Next</a>}
            </nav>
          )}
        </main>
      </div>
      <BottomNav currentPath={currentPath} />
    </div>
  );
}
