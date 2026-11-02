import { useState } from "react";
import { BottomNav, TopNav, type SessionUser } from "./AppShell.js";

type ThreadsPageProps = {
  currentUser?: SessionUser | null;
  currentPath?: string;
};

const CATEGORIES = [
  { key: "all", label: "All", icon: "/assets/threads/nav-threads-active.svg", activeIcon: "/assets/threads/all-active.svg", count: 24 },
  { key: "study", label: "Study", icon: "/assets/finder/sidebar-study.svg", count: 11 },
  { key: "gaming", label: "Gaming", icon: "/assets/finder/sidebar-gaming.svg", count: 8 },
  { key: "friends", label: "Friends", icon: "/assets/study/sidebar-friends.svg", count: 5 },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

const REPLIES = [
  {
    name: "Maya Patel",
    time: "1h ago",
    avatar: "/assets/threads/maya.png",
    body: "I’m in! Free Tuesday and Thursday after 4 — Atkins works for me.",
  },
  {
    name: "Leo Chen",
    time: "45m ago",
    avatar: "/assets/threads/leo.png",
    body: "Count me in too. I can bring the practice exam from last semester.",
  },
] as const;

export default function ThreadsPageView({
  currentUser: user,
  currentPath = "",
}: ThreadsPageProps) {
  const [category, setCategory] = useState<CategoryKey>("all");
  const showStudy = category === "all" || category === "study";
  const showGaming = category === "all" || category === "gaming";

  return (
    <div className="app-shell finder-page">
      <TopNav user={user} currentPath={currentPath} />

      <div className="finder-workspace">
        <aside className="finder-sidebar threads-sidebar">
          <div className="finder-sidebar-group">
            <p className="finder-sidebar-label">THREADS</p>
            {CATEGORIES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`finder-sidebar-link${category === item.key ? " is-active" : ""}`}
                onClick={() => setCategory(item.key)}
              >
                <img
                  src={
                    category === item.key && "activeIcon" in item
                      ? item.activeIcon
                      : item.icon
                  }
                  alt=""
                  width={20}
                  height={20}
                  aria-hidden="true"
                />
                <span className="threads-link-label">{item.label}</span>
                <span className="threads-count">{item.count}</span>
              </button>
            ))}
          </div>

          <div className="finder-campus-card">
            <img
              src="/assets/finder/campus-shield.svg"
              alt=""
              width={26}
              height={26}
              aria-hidden="true"
            />
            <p className="finder-campus-title">Keep it Niner.</p>
            <p className="finder-campus-body">
              Be kind, stay on topic, and look out for each other.
            </p>
          </div>

          <div className="finder-sidebar-links">
            <p>Community Guidelines</p>
            <p>Privacy Policy · Terms of Service</p>
          </div>
        </aside>

        <main className="finder-main threads-main">
          <header className="finder-heading">
            <p className="finder-eyebrow">COMMUNITY</p>
            <div className="finder-title-row">
              <h1>Threads</h1>
              <button type="button" className="finder-btn finder-btn-primary threads-new">
                <img src="/assets/threads/plus.svg" alt="" width={20} height={20} />
                New thread
              </button>
            </div>
            <p className="finder-subhead">Ask, plan, and catch up with your campus.</p>
          </header>

          <div className="threads-tabs" role="tablist" aria-label="Thread categories">
            {CATEGORIES.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={category === item.key}
                className={`finder-chip${category === item.key ? " is-active" : ""}`}
                onClick={() => setCategory(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {showStudy && (
            <article className="thread-card thread-card-featured">
              <p className="thread-featured-tag">
                <img
                  src="/assets/threads/sparkles.svg"
                  alt=""
                  width={14}
                  height={14}
                  aria-hidden="true"
                />
                FEATURED
              </p>

              <header className="thread-head">
                <img
                  className="thread-avatar"
                  src="/assets/threads/aisha.png"
                  alt=""
                  width={48}
                  height={48}
                />
                <div className="thread-author">
                  <p className="thread-name">Aisha Rahman</p>
                  <p className="thread-meta">Study · 2h ago</p>
                </div>
                <button type="button" className="thread-more" aria-label="More options">
                  <img src="/assets/threads/more.svg" alt="" width={22} height={22} />
                </button>
              </header>

              <h2 className="thread-title">
                Anyone want to form an ITSC 2214 study group for the midterm?
              </h2>
              <p className="thread-body">
                Thinking Tuesdays and Thursdays at Atkins Library. Bring your
                notes — we’ll quiz each other on linked lists and trees.
              </p>

              <div className="thread-stats">
                <span>
                  <img src="/assets/threads/heart.svg" alt="" width={15} height={15} />
                  24
                </span>
                <span>
                  <img src="/assets/threads/replies.svg" alt="" width={17} height={17} />
                  {REPLIES.length} replies
                </span>
              </div>

              <ul className="thread-replies">
                {REPLIES.map((reply) => (
                  <li key={reply.name} className="thread-reply">
                    <img
                      className="thread-avatar thread-avatar-sm"
                      src={reply.avatar}
                      alt=""
                      width={36}
                      height={36}
                    />
                    <div>
                      <p className="thread-name">
                        {reply.name} <span className="thread-meta">· {reply.time}</span>
                      </p>
                      <p className="thread-reply-body">{reply.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          )}

          {showGaming && (
            <article className="thread-card">
              <header className="thread-head">
                <img
                  className="thread-avatar"
                  src="/assets/threads/jordan.png"
                  alt=""
                  width={48}
                  height={48}
                />
                <div className="thread-author">
                  <p className="thread-name">Jordan Ellis</p>
                  <p className="thread-meta">Gaming · 4h ago</p>
                </div>
                <span className="thread-tag">
                  <img
                    src="/assets/threads/gamepad-sm.svg"
                    alt=""
                    width={18}
                    height={18}
                    aria-hidden="true"
                  />
                  VALORANT
                </span>
              </header>

              <h2 className="thread-title">Looking for a Diamond+ duo, evenings only</h2>
              <p className="thread-body">
                Chill comms, no tilt. Drop your rank and main below.
              </p>

              <div className="thread-stats">
                <span>
                  <img src="/assets/threads/heart.svg" alt="" width={15} height={15} />
                  12
                </span>
                <span>
                  <img src="/assets/threads/replies.svg" alt="" width={17} height={17} />
                  5 replies
                </span>
              </div>
            </article>
          )}

          <div className="thread-create">
            <img
              className="thread-avatar thread-avatar-sm"
              src="/assets/threads/maya.png"
              alt=""
              width={36}
              height={36}
            />
            <input
              type="text"
              className="thread-create-input"
              placeholder="Start a thread…"
              aria-label="Start a thread"
            />
            <button type="button" className="thread-create-btn" aria-label="Create thread">
              <img src="/assets/threads/chat.svg" alt="" width={28} height={28} />
            </button>
          </div>
        </main>
      </div>

      <BottomNav currentPath={currentPath} />
    </div>
  );
}
