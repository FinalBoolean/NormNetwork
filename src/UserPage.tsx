import { BottomNav, TopNav } from "./AppShell.js";
import type { PageProps } from "./App.js";

export default function UserPage({
  currentUser: user,
  currentPath = "",
  person,
}: PageProps) {
  if (!person) return null;
  const details = [
    ["Year", person.class],
    ["Major", person.major],
    person.gender ? ["Gender", person.gender] : null,
    ["Campus", "UNC Charlotte"],
  ].filter((row): row is [string, string] => row !== null);

  return (
    <div className="app-shell finder-page profile-page">
      <TopNav user={user} currentPath={currentPath} />
      <div className="finder-workspace">
        <main className="finder-main profile-main">
          <article className="profile-card">
            <aside className="profile-photo-panel" aria-label="Profile photo">
              <div className="profile-photo-preview">
                {person.profile_picture ? (
                  <img
                    src={person.profile_picture}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="profile-photo-empty">
                    <span>{person.username.slice(0, 2).toUpperCase()}</span>
                  </div>
                )}
              </div>
            </aside>
            <div className="profile-body">
              <div className="profile-identity">
                <p className="profile-eyebrow">NINER PROFILE</p>
                <h1>
                  {person.username}
                  {person.age !== undefined ? `, ${person.age}` : ""}
                </h1>
              </div>
              {person.bio !== undefined && (
                <section className="profile-section">
                  <h2 className="finder-bond-label">ABOUT</h2>
                  <p className="profile-about">
                    {person.bio || "This Niner hasn't added a bio yet."}
                  </p>
                </section>
              )}
              <section className="profile-section">
                <h2 className="finder-bond-label">DETAILS</h2>
                <dl className="profile-details">
                  {details.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              {person.friendsOnly && (
                <p className="privacy-note">
                  Age, gender, and bio are visible to friends.
                </p>
              )}
              {!person.friendsOnly && person.hidden.length > 0 && (
                <p className="privacy-note">
                  Not shared: {person.hidden.join(", ")}.
                </p>
              )}
            </div>
          </article>
        </main>
      </div>
      <BottomNav currentPath={currentPath} />
    </div>
  );
}
