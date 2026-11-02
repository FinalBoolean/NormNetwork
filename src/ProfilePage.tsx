import { BottomNav, FinderSidebar, TopNav } from "./AppShell.js";
import type { PageProps } from "./App.js";

const fields = [
  {
    name: "age",
    label: "Age",
    type: "number",
    required: true,
    min: 1,
    max: 120,
  },
  {
    name: "class",
    label: "Class standing",
    type: "text",
    required: true,
    maxLength: 10,
  },
  {
    name: "gender",
    label: "Gender",
    type: "text",
    required: true,
    maxLength: 20,
  },
  {
    name: "major",
    label: "Major",
    type: "text",
    required: true,
    maxLength: 255,
  },
  {
    name: "profile_picture",
    label: "Profile photo URL (optional)",
    type: "url",
    maxLength: 2048,
  },
] as const;

export default function ProfilePageView({
  currentUser: user,
  currentPath = "",
  profile,
  editingProfile,
  values,
  errors = {},
  notice,
}: PageProps) {
  const editing = !profile || editingProfile;
  const initial: Record<string, string> = values ?? {
    age: profile ? String(profile.age) : "",
    class: profile?.class ?? "",
    gender: profile?.gender ?? "",
    major: profile?.major ?? "",
    bio: profile?.bio ?? "",
    profile_picture: profile?.profile_picture ?? "",
  };
  return (
    <div className="app-shell finder-page">
      <TopNav user={user} currentPath={currentPath} />
      <div className="finder-workspace">
        <FinderSidebar mode="friends" />
        <main className="finder-main profile-main">
          <div className="profile-bar">
            <a className="profile-back" href="/finder/friends">
              <img
                src="/assets/profile/back.svg"
                alt=""
                width={20}
                height={20}
              />
              Back to Friend Finder
            </a>
            {profile && !editing && (
              <a
                className="finder-btn finder-btn-secondary"
                href="/profile?edit=1"
              >
                Edit profile
              </a>
            )}
          </div>
          {notice && (
            <p className="alert alert-info" role="status">
              {notice}
            </p>
          )}
          {editing ? (
            <section className="profile-card profile-editor">
              <div className="profile-body">
                <h1>{profile ? "Edit your profile" : "Set up your profile"}</h1>
                <p className="profile-about">
                  Tell your campus community a little about yourself,{" "}
                  {user?.username}.
                </p>
                {!!Object.keys(errors).length && (
                  <p className="alert alert-error" role="alert">
                    {errors.form ?? "Please fix the highlighted fields."}
                  </p>
                )}
                <form
                  className="form profile-form"
                  method="post"
                  action={profile ? "/profile/edit" : "/profile"}
                  noValidate
                >
                  {fields.map(({ name, label, ...input }) => (
                    <div
                      key={name}
                      className={`field${errors[name] ? " has-error" : ""}`}
                    >
                      <label htmlFor={name}>{label}</label>
                      <input
                        {...input}
                        id={name}
                        name={name}
                        defaultValue={initial[name]}
                        aria-invalid={errors[name] ? true : undefined}
                        aria-describedby={
                          errors[name] ? `${name}-error` : undefined
                        }
                      />
                      {errors[name] && (
                        <p className="field-error" id={`${name}-error`}>
                          {errors[name]}
                        </p>
                      )}
                    </div>
                  ))}
                  <div className={`field${errors.bio ? " has-error" : ""}`}>
                    <label htmlFor="bio">About you (optional)</label>
                    <textarea
                      id="bio"
                      name="bio"
                      rows={5}
                      maxLength={2000}
                      defaultValue={initial.bio}
                      aria-invalid={errors.bio ? true : undefined}
                      aria-describedby={errors.bio ? "bio-error" : undefined}
                    />
                    {errors.bio && (
                      <p className="field-error" id="bio-error">
                        {errors.bio}
                      </p>
                    )}
                  </div>
                  <div className="profile-form-actions">
                    <button
                      type="submit"
                      className="finder-btn finder-btn-primary"
                    >
                      Save profile
                    </button>
                    <a
                      className="finder-btn finder-btn-secondary"
                      href={profile ? "/profile" : "/"}
                    >
                      Cancel
                    </a>
                  </div>
                </form>
              </div>
            </section>
          ) : (
            <article className="profile-card">
              <div className="profile-photo">
                {profile.profile_picture ? (
                  <img
                    src={profile.profile_picture}
                    alt="Your profile photo"
                    className="finder-card-img"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className="profile-photo-placeholder"
                    role="img"
                    aria-label="No profile photo"
                  >
                    {user?.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="profile-body">
                <div className="profile-identity">
                  <p className="finder-verified">Your profile</p>
                  <h1>
                    {user?.username}, {profile.age}
                  </h1>
                </div>
                <section className="profile-section">
                  <h2 className="finder-bond-label">ABOUT</h2>
                  <p className="profile-about">
                    {profile.bio || "Add a bio to tell people about yourself."}
                  </p>
                </section>
                <section className="profile-section">
                  <h2 className="finder-bond-label">DETAILS</h2>
                  <dl className="profile-details">
                    {[
                      ["Year", profile.class],
                      ["Major", profile.major],
                      ["Gender", profile.gender],
                      ["Campus", "UNC Charlotte"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>
            </article>
          )}
        </main>
      </div>
      <BottomNav currentPath={currentPath} />
    </div>
  );
}
