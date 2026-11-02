import { useState } from "react";
import {
  BottomNav,
  FinderSidebar,
  ModeTabs,
  TopNav,
  type SessionUser,
} from "./AppShell.js";

type FriendFinderProps = {
  currentUser?: SessionUser | null;
  currentPath?: string;
};

const FILTERS = ["For you", "Music", "Outdoors"] as const;

const DEMO = {
  name: "Maya Patel",
  age: 20,
  year: "Junior",
  major: "Computer Science",
  bio: "Coffee walks, indie playlists & finding a new favorite spot on campus.",
  interests: ["Live music", "Hiking", "Coffee"],
  hangout: "Usually at the Botanical Gardens",
  sharedCount: 3,
  portrait: "/assets/finder/maya-portrait.png",
  profileHref: "/profile",
} as const;

export default function FriendFinderPage({
  currentUser: user,
  currentPath = "",
}: FriendFinderProps) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("For you");

  return (
    <div className="app-shell finder-page">
      <TopNav user={user} currentPath={currentPath} />

      <div className="finder-workspace">
        <FinderSidebar mode="friends" />

        <main className="finder-main">
          <header className="finder-heading">
            <p className="finder-eyebrow">FRIEND FINDER</p>
            <div className="finder-title-row">
              <h1>Find your people.</h1>
              <button type="button" className="finder-filters-icon" aria-label="All filters">
                <img src="/assets/finder/filters.svg" alt="" width={22} height={22} />
              </button>
            </div>
            <p className="finder-subhead">New faces. Same Niner spirit.</p>
          </header>

          <ModeTabs mode="friends" />

          <div className="finder-filters">
            <div className="finder-filter-chips">
              {FILTERS.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`finder-chip${filter === name ? " is-active" : ""}`}
                  onClick={() => setFilter(name)}
                >
                  {name === "For you" && (
                    <img
                      src={
                        filter === "For you"
                          ? "/assets/finder/sparkles-white.svg"
                          : "/assets/finder/sparkles.svg"
                      }
                      alt=""
                      width={15}
                      height={15}
                      aria-hidden="true"
                    />
                  )}
                  {name}
                </button>
              ))}
            </div>
            <button type="button" className="finder-all-filters">
              <img
                src="/assets/finder/filters.svg"
                alt=""
                width={20}
                height={20}
                aria-hidden="true"
              />
              All filters
            </button>
          </div>

          <article className="finder-card">
            <div className="finder-card-photo">
              <img src={DEMO.portrait} alt="" className="finder-card-img" />
              <div className="finder-card-scrim" aria-hidden="true" />
              <div className="finder-photo-progress" aria-hidden="true">
                <span className="is-on" />
                <span />
                <span />
              </div>
              <p className="finder-shared-pill">
                <img
                  src="/assets/finder/sparkles-card.svg"
                  alt=""
                  width={15}
                  height={15}
                  aria-hidden="true"
                />
                {DEMO.sharedCount} interests in common
              </p>

              <div className="finder-card-mobile-copy">
                <p className="finder-verified finder-verified-light">
                  <img
                    src="/assets/finder/verified-white.svg"
                    alt=""
                    width={15}
                    height={15}
                    aria-hidden="true"
                  />
                  Verified Niner
                </p>
                <div className="finder-name-row">
                  <h2>
                    {DEMO.name}, {DEMO.age}
                  </h2>
                  <a href={DEMO.profileHref} aria-label="Open profile">
                    <img
                      src="/assets/finder/arrow-up-right.svg"
                      alt=""
                      width={24}
                      height={24}
                    />
                  </a>
                </div>
                <p className="finder-meta-light">
                  {DEMO.year} · {DEMO.major}
                </p>
                <p className="finder-bio-light">“{DEMO.bio}”</p>
                <div className="finder-interest-row finder-interest-row-light">
                  {DEMO.interests.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <p className="finder-hangout-light">
                  <img
                    src="/assets/finder/map-pin-white.svg"
                    alt=""
                    width={14}
                    height={14}
                    aria-hidden="true"
                  />
                  {DEMO.hangout}
                </p>
              </div>
            </div>

            <div className="finder-card-body">
              <div className="finder-card-info">
                <p className="finder-verified">
                  <img
                    src="/assets/finder/verified.svg"
                    alt=""
                    width={17}
                    height={17}
                    aria-hidden="true"
                  />
                  Verified Niner
                </p>
                <div className="finder-identity">
                  <h2>
                    {DEMO.name}, {DEMO.age}
                  </h2>
                  <p>
                    {DEMO.year} · {DEMO.major}
                  </p>
                </div>
                <p className="finder-bio">“{DEMO.bio}”</p>
                <div className="finder-bond">
                  <p className="finder-bond-label">WE COULD BOND OVER</p>
                  <div className="finder-interest-row">
                    {DEMO.interests.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
                <p className="finder-hangout">
                  <img
                    src="/assets/finder/map-pin.svg"
                    alt=""
                    width={20}
                    height={20}
                    aria-hidden="true"
                  />
                  {DEMO.hangout}
                </p>
              </div>

              <div className="finder-actions-desktop">
                <div className="finder-action-row">
                  <button type="button" className="finder-btn finder-btn-secondary">
                    <img src="/assets/finder/pass.svg" alt="" width={20} height={20} />
                    Pass
                  </button>
                  <button type="button" className="finder-btn finder-btn-primary">
                    <img src="/assets/finder/connect.svg" alt="" width={20} height={20} />
                    Connect
                  </button>
                  <a href={DEMO.profileHref} className="finder-btn finder-btn-secondary">
                    <img
                      src="/assets/finder/profile-info.svg"
                      alt=""
                      width={20}
                      height={20}
                    />
                    Profile
                  </a>
                </div>
                <p className="finder-note">
                  <img
                    src="/assets/finder/shield-note.svg"
                    alt=""
                    width={16}
                    height={16}
                    aria-hidden="true"
                  />
                  Real students. No dating pressure.
                </p>
              </div>
            </div>
          </article>

          <div className="finder-actions-mobile">
            <div className="finder-swipe">
              <div className="finder-swipe-action">
                <button type="button" className="finder-icon-btn" aria-label="Pass">
                  <img src="/assets/finder/pass.svg" alt="" width={25} height={25} />
                </button>
                <span>Pass</span>
              </div>
              <div className="finder-swipe-action">
                <button
                  type="button"
                  className="finder-icon-btn finder-icon-btn-primary"
                  aria-label="Connect"
                >
                  <img src="/assets/finder/connect.svg" alt="" width={28} height={28} />
                </button>
                <span className="is-emphasis">Connect</span>
              </div>
              <div className="finder-swipe-action">
                <a
                  href={DEMO.profileHref}
                  className="finder-icon-btn"
                  aria-label="Profile"
                >
                  <img
                    src="/assets/finder/profile-info.svg"
                    alt=""
                    width={24}
                    height={24}
                  />
                </a>
                <span>Profile</span>
              </div>
            </div>
            <p className="finder-note finder-note-center">
              <img
                src="/assets/finder/shield-note.svg"
                alt=""
                width={12}
                height={12}
                aria-hidden="true"
              />
              Real students. No dating pressure.
            </p>
          </div>

          <div className="finder-guidance">
            <p>A new friendship starts with a hello.</p>
            <a href={DEMO.profileHref}>View Maya’s full profile →</a>
          </div>
        </main>
      </div>

      <BottomNav currentPath={currentPath} />
    </div>
  );
}
