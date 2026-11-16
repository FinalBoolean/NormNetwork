import {
  BottomNav,
  FinderHeading,
  FinderSidebar,
  ModeTabs,
  TopNav,
  type SessionUser,
} from "./AppShell.js";
import {
  STUDY_SEARCH_MAX,
  studyFinderHref,
  type StudyFinderData,
  type StudyMatch,
} from "./study-finder.js";

type StudyFinderProps = {
  currentUser?: SessionUser | null;
  currentPath?: string;
  studyFinder?: StudyFinderData;
  errors?: Record<string, string>;
};

const NO_RESULTS: StudyFinderData = {
  matches: [],
  q: "",
  course: "",
  page: 1,
  hasMore: false,
  myCourses: [],
  discoverable: false,
};

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

function Icon({ src, size = 16 }: { src: string; size?: number }) {
  return <img src={src} alt="" width={size} height={size} aria-hidden="true" />;
}

function CourseList({ courses }: { courses: string[] }) {
  return (
    <div className="match-course-list">
      {courses.map((course) => (
        <span key={course} className="match-course">
          <Icon src="/assets/study/course.svg" size={28} />
          {course}
        </span>
      ))}
    </div>
  );
}

function StudyBuddyCard({ match }: { match: StudyMatch }) {
  const shared = match.shared_courses;
  const others = match.courses.filter((course) => !shared.includes(course));
  const headingId = `study-buddy-${match.user_id}`;

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
        {shared.length > 0 && (
          <p className="finder-shared-pill">
            <Icon src="/assets/finder/sparkles-card.svg" size={15} />
            {`${plural(shared.length, "course")} in common`}
          </p>
        )}
      </div>

      <div className="match-body">
        <div className="match-info">
          <div className="finder-identity">
            <h2 id={headingId}>
              <a href={`/users/${encodeURIComponent(match.username)}`} aria-label={`View ${match.username}'s profile`}>
                {match.username}
              </a>
            </h2>
            <p>
              {match.class} · {match.major}
            </p>
          </div>
          {match.bio && <p className="finder-bio">“{match.bio}”</p>}

          <div className="match-courses">
            {shared.length > 0 && (
              <>
                <p className="finder-bond-label">WE SHARE</p>
                <CourseList courses={shared} />
              </>
            )}
            {others.length > 0 && (
              <>
                <p className="finder-bond-label">
                  {shared.length > 0 ? "ALSO TAKING" : "COURSES"}
                </p>
                <CourseList courses={others} />
              </>
            )}
          </div>

          <ul className="match-meta">
            <li>
              <Icon src="/assets/study/course.svg" size={18} />
              Studying {match.subject}
            </li>
            {match.availability && (
              <li>
                <Icon src="/assets/study/clock.svg" />
                {match.availability}
              </li>
            )}
            {match.meeting_place && (
              <li>
                <Icon src="/assets/study/pin.svg" size={22} />
                Meet at {match.meeting_place}
              </li>
            )}
          </ul>

          {match.additional_info && (
            <div className="match-help">
              <p className="finder-bond-label">LOOKING FOR HELP WITH</p>
              <p>{match.additional_info}</p>
            </div>
          )}
        </div>

        <div className="match-actions">
          <p className="finder-note">
            <Icon src="/assets/study/note.svg" />
            Meet in public campus spaces. Real students only.
          </p>
        </div>
      </div>
    </article>
  );
}

export default function StudyFinderPage({
  currentUser: user,
  currentPath = "",
  studyFinder = NO_RESULTS,
  errors = {},
}: StudyFinderProps) {
  const { matches, q, course, page, hasMore, myCourses, discoverable } =
    studyFinder;
  const filtered = Boolean(q || course);
  const chipCourses =
    course && !myCourses.includes(course) ? [...myCourses, course] : myCourses;

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

          {!discoverable && (
            <div className="alert alert-info" role="status">
              Other students can't find you here yet.{" "}
              <a href="/profile/study">Set up your study partner profile</a> to
              add your courses and appear in the Study Buddy Finder.
            </div>
          )}

          {errors.course && (
            <div className="alert alert-error" role="alert">
              {errors.course}
            </div>
          )}

          <form
            className="finder-search"
            method="get"
            action="/finder/study"
            role="search"
          >
            {course && <input type="hidden" name="course" value={course} />}
            <label htmlFor="study-search" className="sr-only">
              Search study buddies
            </label>
            <input
              id="study-search"
              name="q"
              type="search"
              defaultValue={q}
              maxLength={STUDY_SEARCH_MAX}
              placeholder="Course, subject, or major"
            />
            <button type="submit" className="finder-btn finder-btn-primary">
              Search
            </button>
          </form>

          <nav className="finder-filters" aria-label="Filter by course">
            <div className="finder-filter-chips">
              <a
                className={`finder-chip${course ? "" : " is-active"}`}
                href={studyFinderHref({ q })}
                aria-current={course ? undefined : "true"}
              >
                All courses
              </a>
              {chipCourses.map((code) => (
                <a
                  key={code}
                  className={`finder-chip${course === code ? " is-active" : ""}`}
                  href={studyFinderHref({ q, course: code })}
                  aria-current={course === code ? "true" : undefined}
                >
                  {code}
                </a>
              ))}
            </div>
            {filtered && (
              <a className="finder-all-filters" href="/finder/study">
                Clear filters
              </a>
            )}
          </nav>

          {matches.length ? (
            <div className="match-list">
              {matches.map((match) => (
                <StudyBuddyCard key={match.user_id} match={match} />
              ))}
            </div>
          ) : (
            <section className="match-empty">
              <h2>No study buddies found</h2>
              <p>
                {filtered
                  ? "No one matches those filters yet. Try another course or search."
                  : "No other students have shared a study partner profile yet. Check back soon."}
              </p>
              {filtered && (
                <a className="finder-btn finder-btn-secondary" href="/finder/study">
                  See everyone
                </a>
              )}
            </section>
          )}

          {(page > 1 || hasMore) && (
            <nav className="match-pages" aria-label="More study buddies">
              {page > 1 && (
                <a
                  className="match-more"
                  href={studyFinderHref({ q, course, page: page - 1 })}
                >
                  Previous
                </a>
              )}
              {hasMore && (
                <a
                  className="match-more"
                  href={studyFinderHref({ q, course, page: page + 1 })}
                >
                  See more study buddies
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
