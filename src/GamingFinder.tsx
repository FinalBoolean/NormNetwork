import { useState } from "react";
import {
  BottomNav,
  FinderHeading,
  FinderSidebar,
  ModeTabs,
  TopNav,
  type SessionUser,
} from "./AppShell.js";

type GamingFinderProps = {
  currentUser?: SessionUser | null;
  currentPath?: string;
};

const FILTERS = ["VALORANT", "Competitive", "Mic on"] as const;

const DEMO = {
  name: "Jordan Ellis",
  age: 21,
  year: "Senior",
  major: "Software Engineering",
  bio: "Chill comms, no tilt. Looking for a duo to climb with after class.",
  game: "VALORANT",
  rank: "Diamond 2",
  role: "Controller main",
  comms: "Mic on · Evenings",
  photo: "/assets/gaming/jordan.png",
  profileHref: "/profile",
} as const;

export default function GamingFinderPage({
  currentUser: user,
  currentPath = "",
}: GamingFinderProps) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("VALORANT");

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

          <div className="finder-filters">
            <div className="finder-filter-chips">
              {FILTERS.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`finder-chip${filter === name ? " is-active" : ""}`}
                  onClick={() => setFilter(name)}
                >
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

          <article className="match-card">
            <div className="match-photo">
              <img src={DEMO.photo} alt="" className="finder-card-img" />
              <p className="finder-shared-pill">
                <img
                  src="/assets/gaming/live.svg"
                  alt=""
                  width={16}
                  height={16}
                  aria-hidden="true"
                />
                Online now
              </p>
            </div>

            <div className="match-body">
              <div className="match-info">
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

                <ul className="match-stats">
                  <li>
                    <span className="match-stat-icon">
                      <img
                        src="/assets/gaming/rank.svg"
                        alt=""
                        width={18}
                        height={18}
                        aria-hidden="true"
                      />
                    </span>
                    <span>
                      <span className="match-stat-label">RANK</span>
                      <span className="match-stat-value">
                        {DEMO.game} · {DEMO.rank}
                      </span>
                    </span>
                  </li>
                  <li>
                    <span className="match-stat-icon">
                      <img
                        src="/assets/gaming/headset.svg"
                        alt=""
                        width={24}
                        height={24}
                        aria-hidden="true"
                      />
                    </span>
                    <span>
                      <span className="match-stat-label">COMMS</span>
                      <span className="match-stat-value">{DEMO.comms}</span>
                    </span>
                  </li>
                </ul>

                <div className="finder-bond">
                  <p className="finder-bond-label">PLAYS</p>
                  <div className="finder-interest-row">
                    <span>{DEMO.role}</span>
                    <span>Ranked</span>
                    <span>Evenings</span>
                  </div>
                </div>
              </div>

              <div className="match-actions">
                <div className="finder-action-row">
                  <button type="button" className="finder-btn finder-btn-secondary">
                    <img src="/assets/finder/pass.svg" alt="" width={20} height={20} />
                    Pass
                  </button>
                  <button type="button" className="finder-btn finder-btn-primary">
                    <img src="/assets/gaming/gamepad.svg" alt="" width={15} height={15} />
                    Let’s team up
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
                  Good vibes only. Report toxic players anytime.
                </p>
              </div>
            </div>
          </article>
        </main>
      </div>

      <BottomNav currentPath={currentPath} />
    </div>
  );
}
