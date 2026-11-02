import { useState } from "react";
import {
  BottomNav,
  FinderHeading,
  FinderSidebar,
  ModeTabs,
  TopNav,
  type SessionUser,
} from "./AppShell.js";

type StudyFinderProps = {
  currentUser?: SessionUser | null;
  currentPath?: string;
};

const FILTERS = ["CS", "ITSC 2214", "Evenings"] as const;

const DEMO = {
  name: "Maya Patel",
  age: 20,
  year: "Junior",
  major: "Computer Science",
  bio: "Looking for someone to quiz me on data structures before the midterm.",
  courses: ["ITSC 2214", "ITSC 3155"],
  sharedCount: 2,
  schedule: "Tue & Thu · 4–6 PM",
  place: "Atkins Library, 3rd floor",
  photo: "/assets/study/maya.png",
  profileHref: "/profile",
} as const;

export default function StudyFinderPage({
  currentUser: user,
  currentPath = "",
}: StudyFinderProps) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("CS");

  return (
    <div className="app-shell finder-page">
      <TopNav user={user} currentPath={currentPath} />

      <div className="finder-workspace">
        <FinderSidebar mode="study" />

        <main className="finder-main">
          <FinderHeading
            eyebrow="STUDY BUDDY FINDER"
            title="Better grades. Together."
            subhead="Pair up with Niners in your courses."
          />

          <ModeTabs mode="study" />

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
                  src="/assets/finder/sparkles-card.svg"
                  alt=""
                  width={15}
                  height={15}
                  aria-hidden="true"
                />
                {DEMO.sharedCount} courses in common
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

                <div className="match-courses">
                  <p className="finder-bond-label">WE SHARE</p>
                  <div className="match-course-list">
                    {DEMO.courses.map((course) => (
                      <span key={course} className="match-course">
                        <img
                          src="/assets/study/course.svg"
                          alt=""
                          width={28}
                          height={28}
                          aria-hidden="true"
                        />
                        {course}
                      </span>
                    ))}
                  </div>
                </div>

                <ul className="match-meta">
                  <li>
                    <img
                      src="/assets/study/clock.svg"
                      alt=""
                      width={16}
                      height={16}
                      aria-hidden="true"
                    />
                    {DEMO.schedule}
                  </li>
                  <li>
                    <img
                      src="/assets/study/pin.svg"
                      alt=""
                      width={22}
                      height={22}
                      aria-hidden="true"
                    />
                    Meet at {DEMO.place}
                  </li>
                </ul>
              </div>

              <div className="match-actions">
                <div className="finder-action-row">
                  <button type="button" className="finder-btn finder-btn-secondary">
                    <img src="/assets/finder/pass.svg" alt="" width={20} height={20} />
                    Pass
                  </button>
                  <button type="button" className="finder-btn finder-btn-primary">
                    <img src="/assets/study/sparkles.svg" alt="" width={15} height={15} />
                    Study together
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
                    src="/assets/study/note.svg"
                    alt=""
                    width={16}
                    height={16}
                    aria-hidden="true"
                  />
                  Meet in public campus spaces. Real students only.
                </p>
              </div>
            </div>
          </article>

          <a className="match-more" href="/finder/study">
            See more study buddies
            <img
              src="/assets/study/chevron.svg"
              alt=""
              width={18}
              height={18}
              aria-hidden="true"
            />
          </a>
        </main>
      </div>

      <BottomNav currentPath={currentPath} />
    </div>
  );
}
