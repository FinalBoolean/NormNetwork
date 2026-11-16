export type SessionUser = {
  id: number;
  username: string;
  email: string;
};

export type FinderMode = "friends" | "study" | "gaming";

const NAV_ITEMS = [
  {
    href: "/finder",
    label: "Discover",
    icon: "/assets/threads/nav-discover.svg",
    activeIcon: "/assets/finder/nav-discover.svg",
  },
  {
    href: "/threads",
    label: "Threads",
    icon: "/assets/finder/nav-threads.svg",
    activeIcon: "/assets/threads/nav-threads-active.svg",
  },
  {
    href: "/friends",
    label: "Friends",
    icon: "/assets/finder/nav-friends.svg",
    activeIcon: "/assets/friends/nav-friends-active.svg",
  },
  {
    href: "/profile",
    label: "You",
    icon: "/assets/finder/nav-you.svg",
    activeIcon: "/assets/finder/nav-you-active.svg",
  },
] as const;

function initials(user?: SessionUser | null) {
  if (!user?.username) return "?";
  return user.username.slice(0, 2).toUpperCase();
}

export function Brand() {
  return (
    <a className="app-brand" href="/">
      <span className="app-brand-emblem" aria-hidden="true">
        <img
          src="/assets/join/brand-network.svg"
          alt=""
          width={25}
          height={25}
        />
      </span>
      <span>norm’s network</span>
    </a>
  );
}

export function TopNav({
  user,
  currentPath,
}: {
  user?: SessionUser | null;
  currentPath: string;
}) {
  return (
    <header className="app-topnav">
      <Brand />
      <nav className="app-topnav-destinations" aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const active = currentPath.startsWith(item.href);
          return (
            <a
              key={item.href}
              href={item.href}
              className={`app-topnav-item${active ? " is-active" : ""}`}
            >
              <img
                src={active ? item.activeIcon : item.icon}
                alt=""
                width={20}
                height={20}
                aria-hidden="true"
              />
              {item.label}
            </a>
          );
        })}
      </nav>
      <div className="app-topnav-account">
        <span className="app-campus-badge">
          <img
            src="/assets/finder/badge-check.svg"
            alt=""
            width={18}
            height={18}
            aria-hidden="true"
          />
          CHARLOTTE
        </span>
        {user ? (
          <div className="app-signed-in">
            <span className="app-avatar" aria-hidden="true">
              {initials(user)}
            </span>
            <span className="app-signed-name">{user.username}</span>
            <form method="post" action="/logout" className="app-logout">
              <button type="submit" className="app-logout-btn">
                Log out
              </button>
            </form>
          </div>
        ) : (
          <a className="join-btn join-btn-secondary" href="/login">
            Log in
          </a>
        )}
      </div>
    </header>
  );
}

export function BottomNav({ currentPath }: { currentPath: string }) {
  return (
    <nav className="app-bottomnav" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active = currentPath.startsWith(item.href);
        return (
          <a
            key={item.href}
            href={item.href}
            className={`app-bottomnav-item${active ? " is-active" : ""}`}
          >
            <span className="app-bottomnav-icon">
              <img
                src={active ? item.activeIcon : item.icon}
                alt=""
                width={21}
                height={21}
              />
            </span>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

const SIDEBAR_LINKS = [
  {
    key: "friends",
    href: "/finder/friends",
    label: "Friends",
    icon: "/assets/study/sidebar-friends.svg",
    activeIcon: "/assets/finder/sidebar-friends.svg",
  },
  {
    key: "study",
    href: "/finder/study",
    label: "Study",
    icon: "/assets/finder/sidebar-study.svg",
    activeIcon: "/assets/study/sidebar-study-active.svg",
  },
  {
    key: "gaming",
    href: "/finder/gaming",
    label: "Gaming",
    icon: "/assets/finder/sidebar-gaming.svg",
    activeIcon: "/assets/gaming/sidebar-gaming-active.svg",
  },
] as const;

export function FinderSidebar({ mode }: { mode?: FinderMode }) {
  return (
    <aside className="finder-sidebar">
      <div className="finder-sidebar-group">
        <p className="finder-sidebar-label">FIND YOUR PEOPLE</p>
        {SIDEBAR_LINKS.map((link) => {
          const active = mode === link.key;
          return (
            <a
              key={link.key}
              href={link.href}
              className={`finder-sidebar-link${active ? " is-active" : ""}`}
            >
              <img
                src={active ? link.activeIcon : link.icon}
                alt=""
                width={20}
                height={20}
                aria-hidden="true"
              />
              {link.label}
            </a>
          );
        })}
      </div>

      <div className="finder-campus-card">
        <img
          src="/assets/finder/campus-shield.svg"
          alt=""
          width={26}
          height={26}
          aria-hidden="true"
        />
        <p className="finder-campus-title">Your campus. Your people.</p>
        <p className="finder-campus-body">
          One network, just for UNC Charlotte. Every Niner is campus-email
          verified.
        </p>
      </div>

      <div className="finder-sidebar-links">
        <p>Community Guidelines</p>
        <p>Privacy Policy · Terms of Service</p>
      </div>
    </aside>
  );
}

export function ModeTabs({ mode }: { mode: FinderMode }) {
  const tabs = [
    { key: "friends", href: "/finder/friends", label: "Friends", icon: "/assets/study/sidebar-friends.svg" },
    { key: "study", href: "/finder/study", label: "Study", icon: "/assets/finder/sidebar-study.svg" },
    { key: "gaming", href: "/finder/gaming", label: "Gaming", icon: "/assets/finder/sidebar-gaming.svg" },
  ] as const;

  return (
    <div className="finder-mode-tabs" role="tablist" aria-label="Finder mode">
      {tabs.map((tab) => (
        <a
          key={tab.key}
          href={tab.href}
          role="tab"
          aria-selected={mode === tab.key}
          className={`finder-mode-tab${mode === tab.key ? " is-active" : ""}`}
        >
          <img src={tab.icon} alt="" width={16} height={16} aria-hidden="true" />
          {tab.label}
        </a>
      ))}
    </div>
  );
}

export function FinderHeading({
  eyebrow,
  title,
  subhead,
}: {
  eyebrow: string;
  title: string;
  subhead: string;
}) {
  return (
    <header className="finder-heading">
      <p className="finder-eyebrow">{eyebrow}</p>
      <div className="finder-title-row">
        <h1>{title}</h1>
        <button type="button" className="finder-filters-icon" aria-label="All filters">
          <img src="/assets/finder/filters.svg" alt="" width={22} height={22} />
        </button>
      </div>
      <p className="finder-subhead">{subhead}</p>
    </header>
  );
}
