import { BottomNav, TopNav, type SessionUser } from "./AppShell.js";

const DESTINATIONS = [
  {
    href: "/finder/friends",
    eyebrow: "FRIEND FINDER",
    title: "Find your people.",
    body: "New faces. Same Niner spirit.",
    icon: "/assets/join/feature-friends.svg",
    darkIcon: true,
  },
  {
    href: "/finder/study",
    eyebrow: "STUDY BUDDY FINDER",
    title: "Better grades. Together.",
    body: "Find someone who gets your course load.",
    icon: "/assets/join/feature-study.svg",
    darkIcon: true,
  },
  {
    href: "/finder/gaming",
    eyebrow: "GAMING PARTNER FINDER",
    title: "Find your next duo.",
    body: "Good comms. Better company. Niners only.",
    icon: "/assets/join/feature-gaming.svg",
    darkIcon: true,
  },
  {
    href: "/threads",
    eyebrow: "PUBLIC THREADS",
    title: "The campus conversation.",
    body: "A little less scrolling. A lot more connecting.",
    icon: "/assets/finder/campus-shield.svg",
    darkIcon: false,
  },
] as const;

type HomePageProps = {
  currentUser?: SessionUser | null;
  currentPath?: string;
};

export default function HomePage({
  currentUser: user,
  currentPath = "/",
}: HomePageProps) {
  return (
    <div className="app-shell home-page">
      <TopNav user={user} currentPath={currentPath} />

      <main className="home-main">
        <section className="home-hero">
          <div className="home-motto">
            <span className="join-accent-line" aria-hidden="true" />
            <p>YOUR CAMPUS. YOUR PEOPLE.</p>
          </div>
          <h1>{`Welcome back, ${user?.username}.`}</h1>
          <p className="home-lede">
            Pick up where you left off: find people, or jump into a thread.
          </p>
          <div className="home-actions">
            <a className="join-btn join-btn-primary home-action-btn" href="/finder/friends">
              <img
                src="/assets/join/arrow-right.svg"
                alt=""
                width={20}
                height={20}
                aria-hidden="true"
              />
              Open Discover
            </a>
            <a className="join-btn join-btn-secondary" href="/profile">
              Your profile
            </a>
          </div>
        </section>

        <section className="home-destinations" aria-label="Where to go next">
          {DESTINATIONS.map((item) => (
            <a key={item.href} className="home-card" href={item.href}>
              <span
                className={`home-card-icon${item.darkIcon ? " home-card-icon-dark" : ""}`}
                aria-hidden="true"
              >
                <img src={item.icon} alt="" width={24} height={24} />
              </span>
              <p className="home-card-eyebrow">{item.eyebrow}</p>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </a>
          ))}
        </section>

        <p className="home-assurance">
          <img
            src="/assets/join/shield.svg"
            alt=""
            width={20}
            height={20}
            aria-hidden="true"
          />
          Real students. No dating pressure.
        </p>
      </main>

      <BottomNav currentPath={currentPath} />
    </div>
  );
}
