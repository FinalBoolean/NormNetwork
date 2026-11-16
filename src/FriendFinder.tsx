import { useState } from "react";
import {
  BottomNav,
  FinderSidebar,
  ModeTabs,
  TopNav,
  type SessionUser,
} from "./AppShell.js";
import type { FinderData, FriendCandidate } from "./finder.js";
import {
  CandidatePhoto,
  ConnectButton,
  EMPTY_FINDER,
  FinderStatus,
  candidateName,
  profileHref,
  useCandidates,
} from "./FinderCards.js";

type FriendFinderProps = {
  currentUser?: SessionUser | null;
  currentPath?: string;
  finder?: FinderData;
  notice?: string;
};

const FILTERS = ["For you", "Music", "Outdoors"] as const;
const PATH = "/finder/friends";

export default function FriendFinderPage({
  currentUser: user,
  currentPath = "",
  finder = EMPTY_FINDER,
  notice,
}: FriendFinderProps) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("For you");
  const { current, pass } = useCandidates(
    finder.candidates.filter(
      (candidate): candidate is FriendCandidate => candidate.kind === "friends",
    ),
  );
  const tags = current?.shared.length ? current.shared : current?.interests ?? [];

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

          <FinderStatus
            finder={finder}
            notice={notice}
            hasCurrent={!!current}
            path={PATH}
            noun="new friends"
          />

          {current && (
            <>
              <article className="finder-card" key={current.profileId}>
                <div className="finder-card-photo">
                  <CandidatePhoto candidate={current} />
                  <div className="finder-card-scrim" aria-hidden="true" />
                  {current.shared.length > 0 && (
                    <p className="finder-shared-pill">
                      <img
                        src="/assets/finder/sparkles-card.svg"
                        alt=""
                        width={15}
                        height={15}
                        aria-hidden="true"
                      />
                      {current.shared.length}{" "}
                      {current.shared.length === 1 ? "interest" : "interests"} in common
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
                      <h2>{candidateName(current)}</h2>
                      <a href={profileHref(current)} aria-label="Open profile">
                        <img
                          src="/assets/finder/arrow-up-right.svg"
                          alt=""
                          width={24}
                          height={24}
                        />
                      </a>
                    </div>
                    <p className="finder-meta-light">
                      {current.class} · {current.major}
                    </p>
                    {current.bio && <p className="finder-bio-light">“{current.bio}”</p>}
                    {tags.length > 0 && (
                      <div className="finder-interest-row finder-interest-row-light">
                        {tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
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
                      <h2>{candidateName(current)}</h2>
                      <p>
                        {current.class} · {current.major}
                      </p>
                    </div>
                    {current.bio && <p className="finder-bio">“{current.bio}”</p>}
                    {tags.length > 0 && (
                      <div className="finder-bond">
                        <p className="finder-bond-label">
                          {current.shared.length ? "WE COULD BOND OVER" : "INTO"}
                        </p>
                        <div className="finder-interest-row">
                          {tags.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="finder-actions-desktop">
                    <div className="finder-action-row">
                      <button
                        type="button"
                        className="finder-btn finder-btn-secondary"
                        onClick={pass}
                      >
                        <img src="/assets/finder/pass.svg" alt="" width={20} height={20} />
                        Pass
                      </button>
                      <ConnectButton
                        candidate={current}
                        hasProfile={finder.hasProfile}
                        returnTo={PATH}
                      >
                        <img src="/assets/finder/connect.svg" alt="" width={20} height={20} />
                        Connect
                      </ConnectButton>
                      <a href={profileHref(current)} className="finder-btn finder-btn-secondary">
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
                    <button
                      type="button"
                      className="finder-icon-btn"
                      aria-label="Pass"
                      onClick={pass}
                    >
                      <img src="/assets/finder/pass.svg" alt="" width={25} height={25} />
                    </button>
                    <span>Pass</span>
                  </div>
                  <div className="finder-swipe-action">
                    <ConnectButton
                      candidate={current}
                      hasProfile={finder.hasProfile}
                      returnTo={PATH}
                      className="finder-icon-btn finder-icon-btn-primary"
                    >
                      <img src="/assets/finder/connect.svg" alt="" width={28} height={28} />
                    </ConnectButton>
                    <span className="is-emphasis">Connect</span>
                  </div>
                  <div className="finder-swipe-action">
                    <a
                      href={profileHref(current)}
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
                <a href={profileHref(current)}>View {current.username}’s full profile →</a>
              </div>
            </>
          )}
        </main>
      </div>

      <BottomNav currentPath={currentPath} />
    </div>
  );
}
