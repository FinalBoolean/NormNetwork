import {
  BottomNav,
  FinderSidebar,
  TopNav,
  type SessionUser,
} from "./AppShell.js";

type ProfilePageProps = {
  currentUser?: SessionUser | null;
  currentPath?: string;
};

const DEMO = {
  name: "Maya Patel",
  age: 20,
  photo: "/assets/profile/maya.png",
  photoCount: "1 / 4",
  hangouts: ["Botanical Gardens", "Atkins Library", "Union Coffee Shop"],
  about:
    "Coffee walks, indie playlists & finding a new favorite spot on campus. Always down to trade study tips or catch a live show in NoDa.",
  details: [
    { label: "Year", value: "Junior" },
    { label: "Major", value: "Computer Science" },
    { label: "Hometown", value: "Raleigh, NC" },
    { label: "Campus", value: "UNC Charlotte" },
  ],
  interests: ["Live music", "Hiking", "Coffee", "Indie playlists", "Photography"],
} as const;

export default function ProfilePageView({
  currentUser: user,
  currentPath = "",
}: ProfilePageProps) {
  return (
    <div className="app-shell finder-page">
      <TopNav user={user} currentPath={currentPath} />

      <div className="finder-workspace">
        <FinderSidebar mode="friends" />

        <main className="finder-main profile-main">
          <div className="profile-bar">
            <a className="profile-back" href="/finder/friends">
              <img src="/assets/profile/back.svg" alt="" width={20} height={20} />
              Back to Friend Finder
            </a>
            <button type="button" className="profile-more" aria-label="More options">
              <img src="/assets/profile/more.svg" alt="" width={24} height={24} />
            </button>
          </div>

          <article className="profile-card">
            <div className="profile-photo">
              <img src={DEMO.photo} alt="" className="finder-card-img" />
              <p className="profile-photo-count">
                <img
                  src="/assets/profile/photos.svg"
                  alt=""
                  width={16}
                  height={16}
                  aria-hidden="true"
                />
                {DEMO.photoCount}
              </p>
            </div>

            <div className="profile-body">
              <div className="profile-identity">
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
                <h1>
                  {DEMO.name}, {DEMO.age}
                </h1>
              </div>

              <button type="button" className="finder-btn finder-btn-primary profile-connect">
                <img src="/assets/finder/connect.svg" alt="" width={20} height={20} />
                Connect with Maya
              </button>

              <section className="profile-section">
                <h2 className="finder-bond-label">HANGOUTS</h2>
                <ul className="profile-hangouts">
                  {DEMO.hangouts.map((place) => (
                    <li key={place}>
                      <img
                        src="/assets/profile/pin.svg"
                        alt=""
                        width={24}
                        height={24}
                        aria-hidden="true"
                      />
                      {place}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="profile-section">
                <h2 className="finder-bond-label">ABOUT</h2>
                <p className="profile-about">{DEMO.about}</p>
              </section>

              <section className="profile-section">
                <h2 className="finder-bond-label">DETAILS</h2>
                <dl className="profile-details">
                  {DEMO.details.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="profile-section">
                <h2 className="finder-bond-label">INTERESTS</h2>
                <div className="finder-interest-row">
                  {DEMO.interests.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </section>
            </div>
          </article>
        </main>
      </div>

      <BottomNav currentPath={currentPath} />
    </div>
  );
}
