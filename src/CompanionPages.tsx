import type { InputHTMLAttributes, ReactNode } from "react";
import type { PageProps } from "./App.js";
import { BottomNav, FinderSidebar, TopNav, type FinderMode } from "./AppShell.js";
import {
  COMPANION_INFO,
  COMPANION_TYPES,
  GAME_NAME_MAX,
  GAMING_LIMITS,
  MAX_COURSES,
  MAX_GAMES,
  MIN_DATING_AGE,
  PLATFORMS,
  PLAY_STYLES,
  STUDY_LIMITS,
  VOICE_CHAT,
  splitList,
  type CompanionType,
  type GamingProfile,
  type StudyProfile,
} from "./companions.js";

type Values = Record<string, string>;
type Errors = Record<string, string>;

const describedBy = (name: string, errors: Errors, hint?: ReactNode) =>
  [hint ? `${name}-hint` : "", errors[name] ? `${name}-error` : ""]
    .filter(Boolean)
    .join(" ") || undefined;

function FieldMessages({
  name,
  hint,
  errors,
}: {
  name: string;
  hint?: ReactNode;
  errors: Errors;
}) {
  return (
    <>
      {hint && (
        <p className="field-hint" id={`${name}-hint`}>
          {hint}
        </p>
      )}
      {errors[name] && (
        <p className="field-error" id={`${name}-error`}>
          {errors[name]}
        </p>
      )}
    </>
  );
}

function TextField({
  name,
  label,
  hint,
  initial,
  errors,
  wide,
  ...input
}: {
  name: string;
  label: string;
  hint?: ReactNode;
  initial: Values;
  errors: Errors;
  wide?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div
      className={`field${wide ? " field-wide" : ""}${errors[name] ? " has-error" : ""}`}
    >
      <label htmlFor={name}>{label}</label>
      <input
        type="text"
        {...input}
        id={name}
        name={name}
        defaultValue={initial[name] ?? ""}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={describedBy(name, errors, hint)}
      />
      <FieldMessages name={name} hint={hint} errors={errors} />
    </div>
  );
}

function TextAreaField({
  name,
  label,
  initial,
  errors,
  maxLength,
  placeholder,
}: {
  name: string;
  label: string;
  initial: Values;
  errors: Errors;
  maxLength: number;
  placeholder?: string;
}) {
  return (
    <div className={`field field-wide${errors[name] ? " has-error" : ""}`}>
      <label htmlFor={name}>{label}</label>
      <textarea
        id={name}
        name={name}
        rows={4}
        maxLength={maxLength}
        placeholder={placeholder}
        defaultValue={initial[name] ?? ""}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={describedBy(name, errors)}
      />
      <FieldMessages name={name} errors={errors} />
    </div>
  );
}

function SelectField({
  name,
  label,
  options,
  placeholder,
  initial,
  errors,
}: {
  name: string;
  label: string;
  options: readonly string[];
  placeholder: string;
  initial: Values;
  errors: Errors;
}) {
  return (
    <div className={`field${errors[name] ? " has-error" : ""}`}>
      <label htmlFor={name}>{label}</label>
      <select
        id={name}
        name={name}
        required
        defaultValue={initial[name] ?? ""}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={describedBy(name, errors)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <FieldMessages name={name} errors={errors} />
    </div>
  );
}

type Choice = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

/** A group of checkboxes, shown as cards or as pills. */
function ChoiceGroup({
  name,
  legend,
  choices,
  selected,
  errors,
  hint,
  variant,
}: {
  name: string;
  legend: string;
  choices: Choice[];
  selected: string[];
  errors: Errors;
  hint?: ReactNode;
  variant: "card" | "pill";
}) {
  return (
    <fieldset
      className={`field choice-field${errors[name] ? " has-error" : ""}`}
      aria-describedby={describedBy(name, errors, hint)}
    >
      <legend>{legend}</legend>
      <div className={variant === "card" ? "choice-grid" : "choice-pills"}>
        {choices.map((choice) => (
          <label
            key={choice.value}
            className={`choice choice-${variant}${choice.disabled ? " is-disabled" : ""}`}
          >
            <input
              type="checkbox"
              name={name}
              value={choice.value}
              defaultChecked={selected.includes(choice.value)}
              disabled={choice.disabled}
              aria-invalid={errors[name] ? true : undefined}
            />
            <span className="choice-text">
              <span className="choice-label">{choice.label}</span>
              {choice.description && (
                <span className="choice-description">
                  {choice.description}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      <FieldMessages name={name} hint={hint} errors={errors} />
    </fieldset>
  );
}

function FormActions({ saveLabel }: { saveLabel: string }) {
  return (
    <div className="profile-form-actions">
      <button type="submit" className="finder-btn finder-btn-primary">
        {saveLabel}
      </button>
      <a className="finder-btn finder-btn-secondary" href="/profile">
        Cancel
      </a>
    </div>
  );
}

function RemoveForm({
  action,
  label,
  description,
}: {
  action: string;
  label: string;
  description: string;
}) {
  return (
    <form className="companion-remove" method="post" action={action}>
      <button type="submit" className="companion-remove-btn">
        {label}
      </button>
      <p>{description}</p>
    </form>
  );
}

/** Page layout shared by the companion and partner profile forms. */
function CompanionLayout({
  props,
  mode,
  eyebrow,
  heading,
  intro,
  children,
}: {
  props: PageProps;
  mode?: FinderMode;
  eyebrow: string;
  heading: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  const { currentUser: user, currentPath = "", errors = {}, notice } = props;
  return (
    <div className="app-shell finder-page profile-page companion-page">
      <TopNav user={user} currentPath={currentPath} />
      <div className="finder-workspace">
        <FinderSidebar mode={mode} />
        <main className="finder-main profile-main">
          <div className="profile-bar">
            <a className="profile-back" href="/profile">
              <img
                src="/assets/profile/back.svg"
                alt=""
                width={20}
                height={20}
              />
              Back to your profile
            </a>
          </div>
          {notice && (
            <p className="profile-saved-notice" role="status">
              {notice}
            </p>
          )}
          <section className="profile-card profile-edit-card">
            <div className="profile-body">
              <div>
                <p className="profile-eyebrow">{eyebrow}</p>
                <h1 className="companion-title">{heading}</h1>
              </div>
              <p className="profile-about">{intro}</p>
              {!!Object.keys(errors).length && (
                <p className="alert alert-error" role="alert">
                  {errors.form ?? "Please fix the highlighted fields."}
                </p>
              )}
              {children}
            </div>
          </section>
        </main>
      </div>
      <BottomNav currentPath={currentPath} />
    </div>
  );
}

// ---------- Companion type selection ----------

export function CompanionTypesPage(props: PageProps) {
  const { profile, companionTypes = [], values, errors = {} } = props;
  const selected = values ? splitList(values.companion_types) : companionTypes;
  const canDate = (profile?.age ?? 0) >= MIN_DATING_AGE;
  return (
    <CompanionLayout
      props={props}
      eyebrow="WHAT YOU'RE LOOKING FOR"
      heading="Who do you want to meet?"
      intro="Choose as many as you like. You'll only show up for the things you pick."
    >
      <form
        className="form profile-form"
        method="post"
        action="/profile/companions"
        noValidate
      >
        <ChoiceGroup
          name="companion_types"
          legend="I'm looking for"
          variant="card"
          selected={selected}
          errors={errors}
          hint="You can change this anytime. Turning something off pauses it and keeps the details you entered."
          choices={COMPANION_TYPES.map((type) => ({
            value: type,
            label: COMPANION_INFO[type].label,
            description:
              type === "dating" && !canDate
                ? `Only open to students ${MIN_DATING_AGE} and older.`
                : COMPANION_INFO[type].description,
            disabled: type === "dating" && !canDate,
          }))}
        />
        <FormActions saveLabel="Save" />
      </form>
    </CompanionLayout>
  );
}

// ---------- Study partner profile ----------

export function StudyProfilePage(props: PageProps) {
  const { studyProfile: row, values, errors = {} } = props;
  const initial: Values = values ?? {
    subject: row?.subject ?? "",
    course: row?.course ?? "",
    additional_info: row?.additional_info ?? "",
    availability: row?.availability ?? "",
    meeting_place: row?.meeting_place ?? "",
  };
  return (
    <CompanionLayout
      props={props}
      mode="study"
      eyebrow="STUDY PARTNER PROFILE"
      heading={row ? "Edit your study profile" : "Set up your study profile"}
      intro="Tell other Niners what you're studying so the right study buddy can find you."
    >
      <form
        className="form profile-form"
        method="post"
        action="/profile/study"
        noValidate
      >
        <TextField
          name="subject"
          label="Subject"
          placeholder="Data structures"
          required
          maxLength={STUDY_LIMITS.subject}
          initial={initial}
          errors={errors}
        />
        <TextField
          name="course"
          label="Courses"
          placeholder="ITSC 2214, ITSC 3155"
          required
          autoComplete="off"
          hint={`Course codes separated by commas. Up to ${MAX_COURSES}.`}
          initial={initial}
          errors={errors}
        />
        <TextAreaField
          name="additional_info"
          label="What do you need help with? (optional)"
          placeholder="Quizzing each other before the midterm, working through practice problems..."
          maxLength={STUDY_LIMITS.additional_info}
          initial={initial}
          errors={errors}
        />
        <TextField
          name="availability"
          label="When can you meet? (optional)"
          placeholder="Tue & Thu, 4–6 PM"
          maxLength={STUDY_LIMITS.availability}
          initial={initial}
          errors={errors}
        />
        <TextField
          name="meeting_place"
          label="Favorite study spot (optional)"
          placeholder="Atkins Library, 3rd floor"
          maxLength={STUDY_LIMITS.meeting_place}
          initial={initial}
          errors={errors}
        />
        <FormActions saveLabel="Save study profile" />
      </form>
      {row && (
        <RemoveForm
          action="/profile/study/delete"
          label="Remove study profile"
          description="Deletes these details and turns off Study partners."
        />
      )}
    </CompanionLayout>
  );
}

// ---------- Gaming partner profile ----------

export function GamingProfilePage(props: PageProps) {
  const { gamingProfile: row, values, errors = {} } = props;
  const initial: Values = values ?? {
    games: row?.games ?? "",
    platforms: row?.platforms ?? "",
    rank: row?.rank ?? "",
    main_character: row?.main_character ?? "",
    main_role: row?.main_role ?? "",
    play_style: row?.play_style ?? "",
    voice_chat: row?.voice_chat ?? "",
    availability: row?.availability ?? "",
  };
  return (
    <CompanionLayout
      props={props}
      mode="gaming"
      eyebrow="GAMING PARTNER PROFILE"
      heading={row ? "Edit your gaming profile" : "Set up your gaming profile"}
      intro="Share what you play and how you like to play it, so you can find your next duo."
    >
      <form
        className="form profile-form"
        method="post"
        action="/profile/gaming"
        noValidate
      >
        <TextField
          name="games"
          label="Games you play"
          placeholder="VALORANT, Minecraft"
          required
          wide
          autoComplete="off"
          hint={`Separate games with commas. Up to ${MAX_GAMES}, ${GAME_NAME_MAX} characters each.`}
          initial={initial}
          errors={errors}
        />
        <ChoiceGroup
          name="platforms"
          legend="Platforms"
          variant="pill"
          selected={splitList(initial.platforms)}
          errors={errors}
          choices={PLATFORMS.map((platform) => ({
            value: platform,
            label: platform,
          }))}
        />
        <TextField
          name="rank"
          label="Rank (optional)"
          placeholder="Diamond 2"
          maxLength={GAMING_LIMITS.rank}
          hint="Your rank in your main game. Leave blank if you play unranked."
          initial={initial}
          errors={errors}
        />
        <TextField
          name="main_role"
          label="Main role (optional)"
          placeholder="Controller"
          maxLength={GAMING_LIMITS.main_role}
          initial={initial}
          errors={errors}
        />
        <TextField
          name="main_character"
          label="Main character (optional)"
          placeholder="Omen"
          maxLength={GAMING_LIMITS.main_character}
          hint="Agent, champion, class, or loadout you play most."
          initial={initial}
          errors={errors}
        />
        <TextField
          name="availability"
          label="When do you play? (optional)"
          placeholder="Evenings after 8 PM"
          maxLength={GAMING_LIMITS.availability}
          initial={initial}
          errors={errors}
        />
        <SelectField
          name="play_style"
          label="Play style"
          placeholder="Select play style"
          options={PLAY_STYLES}
          initial={initial}
          errors={errors}
        />
        <SelectField
          name="voice_chat"
          label="Comms"
          placeholder="Select how you talk"
          options={VOICE_CHAT}
          initial={initial}
          errors={errors}
        />
        <FormActions saveLabel="Save gaming profile" />
      </form>
      {row && (
        <RemoveForm
          action="/profile/gaming/delete"
          label="Remove gaming profile"
          description="Deletes these details and turns off Gaming partners."
        />
      )}
    </CompanionLayout>
  );
}

// ---------- Summary on the profile page ----------

type Card = {
  type: Exclude<CompanionType, "friends">;
  title: string;
  href: string;
  details: [string, string | null | undefined][] | null;
};

const studyDetails = (row: StudyProfile): Card["details"] => [
  ["Subject", row.subject],
  ["Courses", row.course],
  ["Meets", row.availability],
  ["Study spot", row.meeting_place],
];

const gamingDetails = (row: GamingProfile): Card["details"] => [
  ["Games", row.games],
  ["Platforms", row.platforms],
  ["Rank", row.rank ?? "Unranked"],
  ["Role", row.main_role],
  ["Main", row.main_character],
  ["Style", row.play_style],
  ["Comms", row.voice_chat],
  ["Plays", row.availability],
];

export function LookingForOverview({
  companionTypes = [],
  studyProfile,
  gamingProfile,
}: Pick<PageProps, "companionTypes" | "studyProfile" | "gamingProfile">) {
  const cards: Card[] = [
    {
      type: "study",
      title: "Study partner profile",
      href: "/profile/study",
      details: studyProfile ? studyDetails(studyProfile) : null,
    },
    {
      type: "gaming",
      title: "Gaming partner profile",
      href: "/profile/gaming",
      details: gamingProfile ? gamingDetails(gamingProfile) : null,
    },
  ];
  const shown = cards.filter(
    (card) => companionTypes.includes(card.type) || card.details,
  );
  const chosen = companionTypes.map((type) => COMPANION_INFO[type].label);
  return (
    <section
      className="companion-overview"
      aria-labelledby="looking-for-heading"
    >
      <div className="companion-overview-head">
        <div>
          <p className="profile-eyebrow">WHAT YOU'RE LOOKING FOR</p>
          <h2 id="looking-for-heading">
            {chosen.length ? chosen.join(" · ") : "Nothing chosen yet"}
          </h2>
        </div>
        <a
          className="finder-btn finder-btn-secondary"
          href="/profile/companions"
        >
          {chosen.length ? "Change" : "Choose"}
        </a>
      </div>
      {!chosen.length && (
        <p className="profile-about">
          Pick friends, study partners, gaming partners, or dating so Niners
          can find you for the right things.
        </p>
      )}
      {shown.length > 0 && (
        <div className="companion-cards">
          {shown.map((card) => {
            const on = companionTypes.includes(card.type);
            const status = !on ? "paused" : card.details ? "active" : "setup";
            return (
              <article key={card.type} className="companion-card">
                <header>
                  <h3>{card.title}</h3>
                  <span className={`companion-status is-${status}`}>
                    {status === "active"
                      ? "On"
                      : status === "paused"
                        ? "Paused"
                        : "Not set up"}
                  </span>
                </header>
                {card.details ? (
                  <dl className="companion-details">
                    {card.details
                      .filter(([, value]) => value)
                      .map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                  </dl>
                ) : (
                  <p className="companion-card-note">
                    Add a few details so the right people can find you.
                  </p>
                )}
                <a className="finder-btn finder-btn-secondary" href={card.href}>
                  {card.details ? "Edit" : "Set up"}
                </a>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
