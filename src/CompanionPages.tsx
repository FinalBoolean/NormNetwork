import type { ReactNode } from "react";
import type { PageProps } from "./App.js";
import { BottomNav, FinderSidebar, TopNav, type FinderMode } from "./AppShell.js";
import {
  COMPANION_INFO,
  COMPANION_TYPES,
  MIN_DATING_AGE,
  splitList,
} from "./companions.js";

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

// ---------- Summary on the profile page ----------

export function LookingForOverview({
  companionTypes = [],
}: Pick<PageProps, "companionTypes">) {
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
    </section>
  );
}
