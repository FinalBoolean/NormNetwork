import ProfilePhotoPanel from "./ProfilePhotoPanel.js";
import { LookingForOverview } from "./CompanionPages.js";
import { BottomNav, FinderSidebar, TopNav } from "./AppShell.js";
import type { PageProps } from "./App.js";
import {
  CLASS_STANDINGS,
  GENDERS,
  MIN_PROFILE_AGE,
  MAX_PROFILE_AGE,
  VISIBILITIES,
  VISIBILITY_OPTIONS,
} from "./profile.js";
import type { Profile } from "./profile.js";
import { MAJOR_OPTIONS, MAJORS_SOURCE } from "./majors.js";

const fields = [
  {
    name: "age",
    label: "Age",
    type: "number",
    required: true,
    min: MIN_PROFILE_AGE,
    max: MAX_PROFILE_AGE,
    step: 1,
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
] as const;

const PRIVACY_FLAGS = [
  ["show_age", "Show my age"],
  ["show_gender", "Show my gender"],
  ["show_bio", "Show my bio"],
] as const;

function hiddenDetailSummary(profile: Profile) {
  const hidden = [
    profile.show_age ? null : "age",
    profile.show_gender ? null : "gender",
    profile.show_bio ? null : "bio",
  ].filter((item): item is string => item !== null);
  if (!hidden.length)
    return "Age, gender, and bio are shared with people allowed to see them.";
  return `Hidden from other Niners: ${hidden.join(", ")}.`;
}

export default function ProfilePageView({
  currentUser: user,
  currentPath = "",
  profile,
  editingProfile,
  values,
  errors = {},
  notice,
  companionTypes,
  studyProfile,
  gamingProfile,
  datingPreferences,
}: PageProps) {
  const editing = !profile || editingProfile;
  const initial: Record<string, string> = {
    age: profile ? String(profile.age) : "",
    class: profile?.class ?? "",
    gender: profile?.gender ?? "",
    major: profile?.major ?? "",
    bio: profile?.bio ?? "",
    profile_picture: profile?.profile_picture ?? "",
    visibility: profile?.visibility ?? "private",
    show_age: profile?.show_age === false ? "0" : "1",
    show_gender: profile?.show_gender === false ? "0" : "1",
    show_bio: profile?.show_bio === false ? "0" : "1",
    ...(values ?? {}),
  };
  const visibilityValue = (VISIBILITIES as readonly string[]).includes(
    initial.visibility,
  )
    ? initial.visibility
    : "private";
  const privacyOption = VISIBILITY_OPTIONS.find(
    (option) => option.value === profile?.visibility,
  );
  return (
    <div className="app-shell finder-page profile-page">
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
            <p className="profile-saved-notice" role="status">
              {notice}
            </p>
          )}
          {!profile && (
            <p className="profile-about">
              Save your profile first, then upload a photo.
            </p>
          )}
          {editing ? (
            <section className="profile-card profile-edit-card">
              {profile && (
                <ProfilePhotoPanel
                  photo={profile.profile_picture}
                  username={user?.username ?? ""}
                  error={errors.photo}
                />
              )}
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
                      {name === "class" || name === "gender" ? (
                        <select
                          id={name}
                          name={name}
                          required
                          defaultValue={initial[name]}
                          aria-invalid={errors[name] ? true : undefined}
                          aria-describedby={
                            errors[name] ? `${name}-error` : undefined
                          }
                        >
                          <option value="">
                            {name === "class"
                              ? "Select class standing"
                              : "Select gender"}
                          </option>
                          {(name === "class" ? CLASS_STANDINGS : GENDERS).map(
                            (value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ),
                          )}
                        </select>
                      ) : (
                        <input
                          {...input}
                          id={name}
                          name={name}
                          defaultValue={initial[name]}
                          list={name === "major" ? "major-options" : undefined}
                          placeholder={
                            name === "major"
                              ? "Search for your major..."
                              : undefined
                          }
                          autoComplete={name === "major" ? "off" : undefined}
                          aria-invalid={errors[name] ? true : undefined}
                          aria-describedby={
                            errors[name] ? `${name}-error` : undefined
                          }
                        />
                      )}
                      {name === "major" && (
                        <>
                          <datalist id="major-options">
                            {MAJOR_OPTIONS.map((major) => (
                              <option value={major} key={major} />
                            ))}
                          </datalist>
                          <p className="field-hint">
                            Type to search, then choose a program.{" "}
                            <a
                              href={MAJORS_SOURCE}
                              target="_blank"
                              rel="noreferrer"
                            >
                              UNC Charlotte program list
                            </a>
                            . Choose Undecided if you have not declared a major.
                          </p>
                        </>
                      )}
                      {name === "age" && (
                        <p className="field-hint">
                          Age must be between {MIN_PROFILE_AGE} and{" "}
                          {MAX_PROFILE_AGE}.
                        </p>
                      )}
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
                  <fieldset className="privacy-fields">
                    <legend>Privacy</legend>
                    <div
                      className={`field${errors.visibility ? " has-error" : ""}`}
                    >
                      <label htmlFor="visibility">Who can open your profile</label>
                      <select
                        id="visibility"
                        name="visibility"
                        defaultValue={visibilityValue}
                        aria-invalid={errors.visibility ? true : undefined}
                        aria-describedby="visibility-rules"
                      >
                        {VISIBILITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {errors.visibility && (
                        <p className="field-error" id="visibility-error">
                          {errors.visibility}
                        </p>
                      )}
                    </div>
                    <ul className="privacy-rules" id="visibility-rules">
                      {VISIBILITY_OPTIONS.map((option) => (
                        <li key={option.value}>
                          <strong>{option.label}.</strong> {option.hint}
                        </li>
                      ))}
                    </ul>
                    {PRIVACY_FLAGS.map(([name, label]) => (
                      <label key={name} className="privacy-choice">
                        <input type="hidden" name={name} value="0" />
                        <input
                          type="checkbox"
                          name={name}
                          value="1"
                          defaultChecked={
                            initial[name] !== "0" && initial[name] !== "false"
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                    <p className="field-hint">
                      Unchecked details stay hidden from every other Niner,
                      including friends. You always see your own full profile.
                      Your email is never shown.
                    </p>
                    {(errors.show_age || errors.show_gender || errors.show_bio) && (
                      <p className="field-error">
                        {errors.show_age || errors.show_gender || errors.show_bio}
                      </p>
                    )}
                  </fieldset>
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
              <ProfilePhotoPanel
                photo={profile.profile_picture}
                username={user?.username ?? ""}
                error={errors.photo}
              />
              <div className="profile-body">
                <div className="profile-identity">
                  <p className="profile-eyebrow">YOUR PROFILE</p>
                  <h1>
                    {user?.username}, {profile.age}
                  </h1>
                </div>
                <section className="profile-section">
                  <h2 className="finder-bond-label">ABOUT</h2>
                  <p className="profile-about">
                    {profile.bio ||
                      "A few words about you go a long way. Add your interests, favorite campus spots, or what you’re looking for."}
                  </p>
                </section>
                <section className="profile-section">
                  <h2 className="finder-bond-label">PRIVACY</h2>
                  <p className="profile-about">
                    {privacyOption
                      ? `${privacyOption.label}. ${privacyOption.hint}`
                      : "Only me. Other Niners cannot open your profile."}
                  </p>
                  <p className="profile-about">{hiddenDetailSummary(profile)}</p>
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
          {profile && !editing && (
            <LookingForOverview
              companionTypes={companionTypes}
              studyProfile={studyProfile}
              gamingProfile={gamingProfile}
              datingPreferences={datingPreferences}
            />
          )}
        </main>
      </div>
      <BottomNav currentPath={currentPath} />
    </div>
  );
}
