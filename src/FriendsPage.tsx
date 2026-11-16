import { useState } from "react";
import { BottomNav, TopNav, type SessionUser } from "./AppShell.js";
import { ConnectionActions, PersonAvatar } from "./DiscoverPage.js";
import type { ConnectionsData, DiscoveryPerson } from "./discovery.js";

type FriendsPageProps = {
  currentUser?: SessionUser | null;
  currentPath?: string;
  notice?: string;
  connections?: ConnectionsData;
};

export default function FriendsPageView({
  currentUser: user,
  currentPath = "/friends",
  notice,
  connections = { incoming: [], outgoing: [], friends: [], hasProfile: false },
}: FriendsPageProps) {
  const [search, setSearch] = useState("");
  const sections = [
    { id: "incoming", title: "Incoming requests", people: connections.incoming, empty: "No incoming requests right now." },
    { id: "outgoing", title: "Sent requests", people: connections.outgoing, empty: "You haven’t sent any requests yet." },
    { id: "circle", title: "Your circle", people: connections.friends, empty: "Your next friendship starts with a hello. Discover students and send a request." },
  ];
  const matches = (person: DiscoveryPerson) =>
    `${person.username} ${person.major}`.toLowerCase().includes(search.trim().toLowerCase());

  return (
    <div className="app-shell finder-page connections-page">
      <TopNav user={user} currentPath={currentPath} />
      <div className="finder-workspace">
        <aside className="finder-sidebar friends-sidebar">
          <nav className="finder-sidebar-group" aria-label="Connections sections">
            <p className="finder-sidebar-label">CONNECTIONS</p>
            {sections.map((section) => (
              <a key={section.id} className="finder-sidebar-link" href={`#${section.id}`}>
                <span className="threads-link-label">{section.title}</span>
                <span className="threads-count">{section.people.length}</span>
              </a>
            ))}
            <a className="finder-sidebar-link" href="/discover">Discover students →</a>
          </nav>
          <div className="finder-campus-card">
            <p className="finder-campus-title">A little hello goes a long way.</p>
            <p className="finder-campus-body">Send a request to someone you’d like to know. When they accept, you’ll both appear in each other’s circle.</p>
          </div>
        </aside>

        <main className="finder-main friends-main">
          <header className="finder-heading">
            <p className="finder-eyebrow">YOUR CONNECTIONS</p>
            <h1>Friends</h1>
            <p className="finder-subhead">New connections and your growing circle.</p>
          </header>

          {notice && (
            <p className="profile-saved-notice" role="status">
              {notice}
            </p>
          )}

          {!connections.hasProfile ? (
            <section className="discovery-empty">
              <h2>Start with your profile.</h2>
              <p>Tell your classmates a little about yourself before connecting.</p>
              <a className="finder-btn finder-btn-primary" href="/profile">Create your profile</a>
            </section>
          ) : (
            <>
              <div className="friends-search">
                <img src="/assets/friends/search.svg" alt="" width={20} height={20} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search connections by username or major"
                  aria-label="Search connections by username or major"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              {sections.map((section) => {
                const people = section.people.filter(matches);
                return (
                  <section className="friends-section" id={section.id} key={section.id} aria-labelledby={`${section.id}-title`}>
                    <h2 className="friends-section-title" id={`${section.id}-title`}>
                      {section.title}
                      <span className="threads-count">{people.length}</span>
                    </h2>
                    {people.length ? people.map((person) => (
                      <article key={person.profileId} className={`friend-row${section.id === "incoming" ? " friend-row-request" : ""}`}>
                        <PersonAvatar person={person} />
                        <div className="friend-info">
                          <h3 className="friend-name">
                            <a href={`/users/${encodeURIComponent(person.username)}`} aria-label={`View ${person.username}'s profile`}>
                              {person.username}
                            </a>
                          </h3>
                          <p className="friend-detail">{person.class} · {person.major}</p>
                        </div>
                        <ConnectionActions person={person} hasProfile={connections.hasProfile} returnTo="/friends" />
                      </article>
                    )) : (
                      <p className="connections-empty">{search.trim() ? "No connections match your search." : section.empty}</p>
                    )}
                  </section>
                );
              })}
            </>
          )}
          <a className="finder-btn finder-btn-secondary connections-discover" href="/discover">Discover students</a>
        </main>
      </div>
      <BottomNav currentPath={currentPath} />
    </div>
  );
}
