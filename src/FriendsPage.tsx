import { useState } from "react";
import { BottomNav, TopNav, type SessionUser } from "./AppShell.js";

type FriendsPageProps = {
  currentUser?: SessionUser | null;
  currentPath?: string;
};

const SECTIONS = [
  { key: "friends", label: "Friends", icon: "/assets/friends/friends-list.svg", count: 2 },
  { key: "requests", label: "Requests", icon: "/assets/friends/requests.svg", count: 1 },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const CIRCLE = [
  {
    name: "Aisha Rahman",
    detail: "Senior · Biology",
    avatar: "/assets/friends/aisha.png",
  },
  {
    name: "Leo Chen",
    detail: "Sophomore · Data Science",
    avatar: "/assets/friends/leo.png",
  },
] as const;

export default function FriendsPageView({
  currentUser: user,
  currentPath = "",
}: FriendsPageProps) {
  const [section, setSection] = useState<SectionKey>("friends");

  return (
    <div className="app-shell finder-page">
      <TopNav user={user} currentPath={currentPath} />

      <div className="finder-workspace">
        <aside className="finder-sidebar friends-sidebar">
          <div className="finder-sidebar-group">
            <p className="finder-sidebar-label">CONNECTIONS</p>
            {SECTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`finder-sidebar-link${section === item.key ? " is-active" : ""}`}
                onClick={() => setSection(item.key)}
              >
                <img src={item.icon} alt="" width={20} height={20} aria-hidden="true" />
                <span className="threads-link-label">{item.label}</span>
                <span className="threads-count">{item.count}</span>
              </button>
            ))}
          </div>

          <div className="finder-campus-card">
            <img
              src="/assets/friends/lock.svg"
              alt=""
              width={24}
              height={24}
              aria-hidden="true"
            />
            <p className="finder-campus-title">Friends only.</p>
            <p className="finder-campus-body">
              Your hangouts and details are only visible to Niners you accept.
            </p>
          </div>

          <div className="finder-sidebar-links">
            <p>Community Guidelines</p>
            <p>Privacy Policy · Terms of Service</p>
          </div>
        </aside>

        <main className="finder-main friends-main">
          <header className="finder-heading">
            <p className="finder-eyebrow">YOUR CONNECTIONS</p>
            <h1>Friends</h1>
            <p className="finder-subhead">Requests, replies, and your circle.</p>
          </header>

          <div className="friends-search">
            <img src="/assets/friends/search.svg" alt="" width={20} height={20} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search your friends"
              aria-label="Search your friends"
            />
          </div>

          <section className="friends-section">
            <h2 className="friends-section-title">
              <img src="/assets/friends/requests.svg" alt="" width={20} height={20} aria-hidden="true" />
              Incoming requests
              <span className="threads-count">1</span>
            </h2>
            <article className="friend-row friend-row-request">
              <img
                className="friend-avatar"
                src="/assets/friends/maya.png"
                alt=""
                width={64}
                height={64}
              />
              <div className="friend-info">
                <p className="friend-name">Maya Patel</p>
                <p className="friend-detail">Junior · Computer Science · 3 interests in common</p>
              </div>
              <div className="friend-actions">
                <button type="button" className="finder-btn finder-btn-primary">
                  <img src="/assets/friends/accept.svg" alt="" width={20} height={20} />
                  Accept
                </button>
                <button type="button" className="finder-btn finder-btn-secondary">
                  Decline
                </button>
              </div>
            </article>
          </section>

          <section className="friends-section">
            <h2 className="friends-section-title">Sent requests</h2>
            <article className="friend-row">
              <img
                className="friend-avatar"
                src="/assets/friends/jordan.png"
                alt=""
                width={64}
                height={64}
              />
              <div className="friend-info">
                <p className="friend-name">Jordan Ellis</p>
                <p className="friend-detail">Senior · Software Engineering</p>
              </div>
              <span className="friend-pending">
                <img src="/assets/friends/check.svg" alt="" width={13} height={13} aria-hidden="true" />
                Request sent
              </span>
            </article>
          </section>

          <section className="friends-section">
            <h2 className="friends-section-title">
              <img src="/assets/friends/friends-list.svg" alt="" width={20} height={20} aria-hidden="true" />
              Your circle
              <span className="threads-count">{CIRCLE.length}</span>
            </h2>
            {CIRCLE.map((friend) => (
              <article key={friend.name} className="friend-row">
                <img
                  className="friend-avatar"
                  src={friend.avatar}
                  alt=""
                  width={64}
                  height={64}
                />
                <div className="friend-info">
                  <p className="friend-name">{friend.name}</p>
                  <p className="friend-detail">{friend.detail}</p>
                </div>
                <button
                  type="button"
                  className="friend-message"
                  aria-label={`Message ${friend.name}`}
                >
                  <img src="/assets/friends/message.svg" alt="" width={21} height={21} />
                </button>
              </article>
            ))}
          </section>

          <p className="finder-note">
            <img src="/assets/friends/lock-sm.svg" alt="" width={16} height={16} aria-hidden="true" />
            Only friends can see your hangouts.
          </p>
        </main>
      </div>

      <BottomNav currentPath={currentPath} />
    </div>
  );
}
