import { useState } from "react";
import {
  BottomNav,
  FinderSidebar,
  ModeTabs,
  TopNav,
  type SessionUser,
} from "./AppShell.js";
import type { PublicProfile } from "./profile.js";

type FriendFinderProps = {
  currentUser?: SessionUser | null;
  currentPath?: string;
  person?: PublicProfile;
};

type Card = {
  name: string;
  age?: number;
  year: string;
  major: string;
  bio?: string | null;
  interests: readonly string[];
  hangout?: string;
  sharedCount?: number;
  portrait: string | null;
  profileHref: string;
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
} as const;

function cardFor(person?: PublicProfile): Card {
  if (!person) return { ...DEMO, profileHref: "/discover" };
  return {
    name: person.username,
    age: person.age,
    year: person.class,
    major: person.major,
    bio: person.bio,
    interests: [],
    portrait: person.profile_picture,
    profileHref: `/users/${encodeURIComponent(person.username)}`,
  };
}

export default function FriendFinderPage({
  currentUser: user,
  currentPath = "",
  person,
}: FriendFinderProps) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("For you");
  const card = cardFor(person);
  const heading = card.age === undefined ? card.name : `${card.name}, ${card.age}`;

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
              {card.portrait ? (
                <img
                  src={card.portrait}
                  alt=""
                  className="finder-card-img"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="finder-card-initials" aria-hidden="true">
                  {card.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="finder-card-scrim" aria-hidden="true" />
              <div className="finder-photo-progress" aria-hidden="true">
                <span className="is-on" />
                <span />
                <span />
              </div>
              {card.sharedCount !== undefined && (
                <p className="finder-shared-pill">
                  <img
                    src="/assets/finder/sparkles-card.svg"
                    alt=""
                    width={15}
                    height={15}
                    aria-hidden="true"
                  />
                  {card.sharedCount} interests in common
                </p>
              )}

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
                  <h2>{heading}</h2>
                  <a href={card.profileHref} aria-label={`Open ${card.name}'s profile`}>
                    <img
                      src="/assets/finder/arrow-up-right.svg"
                      alt=""
                      width={24}
                      height={24}
                    />
                  </a>
                </div>
                <p className="finder-meta-light">
                  {card.year} · {card.major}
                </p>
                {card.bio && <p className="finder-bio-light">“{card.bio}”</p>}
                {card.interests.length > 0 && (
                  <div className="finder-interest-row finder-interest-row-light">
                    {card.interests.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                )}
                {card.hangout && (
                  <p className="finder-hangout-light">
                    <img
                      src="/assets/finder/map-pin-white.svg"
                      alt=""
                      width={14}
                      height={14}
                      aria-hidden="true"
                    />
                    {card.hangout}
                  </p>
                )}
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
                  <h2>{heading}</h2>
                  <p>
                    {card.year} · {card.major}
                  </p>
                </div>
                {card.bio && <p className="finder-bio">“{card.bio}”</p>}
                {card.interests.length > 0 && (
                  <div className="finder-bond">
                    <p className="finder-bond-label">WE COULD BOND OVER</p>
                    <div className="finder-interest-row">
                      {card.interests.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                {card.hangout && (
                  <p className="finder-hangout">
                    <img
                      src="/assets/finder/map-pin.svg"
                      alt=""
                      width={20}
                      height={20}
                      aria-hidden="true"
                    />
                    {card.hangout}
                  </p>
                )}
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
                  <a href={card.profileHref} className="finder-btn finder-btn-secondary">
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
                  href={card.profileHref}
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
            <a href={card.profileHref}>
              {person ? `View ${card.name}’s full profile →` : "Browse Niners on Discover →"}
            </a>
          </div>
        </main>
      </div>

      <BottomNav currentPath={currentPath} />
    </div>
  );
}
