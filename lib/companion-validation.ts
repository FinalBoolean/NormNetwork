import {
  COMPANION_INFO,
  COMPANION_TYPES,
  DATING_GOALS,
  DATING_INTERESTS,
  GAME_NAME_MAX,
  GAMING_LIMITS,
  MAX_COURSES,
  MAX_DATING_AGE,
  MAX_GAMES,
  MIN_DATING_AGE,
  PLATFORMS,
  PLAY_STYLES,
  STUDY_LIMITS,
  VOICE_CHAT,
  type CompanionType,
  type DatingPreferences,
  type GamingProfile,
  type StudyProfile,
} from "../src/companions.js";

type Errors = Record<string, string>;
type Body = Record<string, unknown>;

const asBody = (body: unknown) =>
  body && typeof body === "object" && !Array.isArray(body)
    ? (body as Body)
    : null;

/**
 * Reads a list field. Accepts an array (checkboxes, JSON) or a comma-separated
 * string. Trims items, drops blanks and case-insensitive duplicates.
 * Returns null when the value isn't a string or an array of strings.
 */
function list(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return [];
  let items: string[];
  if (typeof raw === "string") items = raw.split(",");
  else if (Array.isArray(raw) && raw.every((item) => typeof item === "string"))
    items = raw.flatMap((item: string) => item.split(","));
  else return null;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const value = item.trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    result.push(value);
  }
  return result;
}

/** Trimmed text. Blank optional fields become null. */
function text(
  input: Body,
  field: string,
  max: number,
  errors: Errors,
  required?: string,
) {
  const raw = input[field];
  if (
    raw === undefined ||
    raw === null ||
    (typeof raw === "string" && !raw.trim())
  ) {
    if (required) errors[field] = required;
    return null;
  }
  if (typeof raw !== "string") {
    errors[field] = "Enter a valid value.";
    return null;
  }
  const value = raw.trim();
  if (value.length > max) {
    errors[field] = `Use at most ${max} characters.`;
    return null;
  }
  return value;
}

/** One value from a fixed list, matched case-insensitively. */
function choice<T extends string>(
  input: Body,
  field: string,
  options: readonly T[],
  errors: Errors,
  message: string,
) {
  const raw = input[field];
  const match =
    typeof raw === "string"
      ? options.find((option) => option.toLowerCase() === raw.trim().toLowerCase())
      : undefined;
  if (!match) errors[field] = message;
  return match ?? null;
}

/** One or more values from a fixed list, returned in the list's order. */
function choices<T extends string>(
  input: Body,
  field: string,
  options: readonly T[],
  errors: Errors,
  messages: { empty: string; invalid: string },
) {
  const items = list(input[field]);
  if (!items) {
    errors[field] = messages.invalid;
    return [];
  }
  const picked = new Set<T>();
  for (const item of items) {
    const match = options.find(
      (option) => option.toLowerCase() === item.toLowerCase(),
    );
    if (!match) {
      errors[field] = messages.invalid;
      return [];
    }
    picked.add(match);
  }
  if (!picked.size) errors[field] = messages.empty;
  return options.filter((option) => picked.has(option));
}

function wholeNumber(raw: unknown) {
  if (typeof raw === "number") return Number.isInteger(raw) ? raw : NaN;
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) return Number(raw);
  return NaN;
}

const invalidBody = (form: string) => ({ errors: { form } as Errors });

// ---------- Companion types ----------

export function validateCompanionTypes(body: unknown, age: number) {
  const input = asBody(body);
  if (!input)
    return { values: [] as CompanionType[], ...invalidBody("Submit your choices.") };
  const errors: Errors = {};
  const values = choices(input, "companion_types", COMPANION_TYPES, errors, {
    empty: "Choose at least one thing you're looking for.",
    invalid: `Choose from ${COMPANION_TYPES.map((t) => COMPANION_INFO[t].label).join(", ")}.`,
  });
  if (values.includes("dating") && age < MIN_DATING_AGE)
    errors.companion_types = `Dating is only open to students ${MIN_DATING_AGE} and older.`;
  return { values, errors };
}

// ---------- Study partner profile ----------

const COURSE_CODE = /^([A-Za-z]{3,4})[\s-]*(\d{4}[A-Za-z]?)$/;

export function validateStudyProfile(body: unknown) {
  const values = {} as Omit<StudyProfile, "user_id">;
  const input = asBody(body);
  if (!input) return { values, ...invalidBody("Submit a study profile.") };
  const errors: Errors = {};

  values.subject =
    text(input, "subject", STUDY_LIMITS.subject, errors, "Enter a subject.") ??
    "";

  const courses = list(input.course);
  if (!courses) errors.course = "Enter a valid value.";
  else if (!courses.length)
    errors.course = "Enter at least one course code, like ITSC 3155.";
  else if (courses.length > MAX_COURSES)
    errors.course = `List at most ${MAX_COURSES} courses.`;
  else {
    const codes = new Set<string>();
    for (const course of courses) {
      const match = COURSE_CODE.exec(course);
      if (!match) {
        errors.course = `"${course.slice(0, 20)}" isn't a course code. Use the format ITSC 3155.`;
        break;
      }
      codes.add(`${match[1].toUpperCase()} ${match[2].toUpperCase()}`);
    }
    values.course = [...codes].join(", ");
  }

  values.additional_info = text(
    input,
    "additional_info",
    STUDY_LIMITS.additional_info,
    errors,
  );
  values.availability = text(
    input,
    "availability",
    STUDY_LIMITS.availability,
    errors,
  );
  values.meeting_place = text(
    input,
    "meeting_place",
    STUDY_LIMITS.meeting_place,
    errors,
  );
  return { values, errors };
}

// ---------- Gaming partner profile ----------

export function validateGamingProfile(body: unknown) {
  const values = {} as Omit<GamingProfile, "user_id">;
  const input = asBody(body);
  if (!input) return { values, ...invalidBody("Submit a gaming profile.") };
  const errors: Errors = {};

  const games = list(input.games);
  if (!games) errors.games = "Enter a valid value.";
  else if (!games.length) errors.games = "Enter at least one game you play.";
  else if (games.length > MAX_GAMES)
    errors.games = `List at most ${MAX_GAMES} games.`;
  else if (games.some((game) => game.length > GAME_NAME_MAX))
    errors.games = `Keep each game name to ${GAME_NAME_MAX} characters or fewer.`;
  else values.games = games.join(", ");

  values.platforms = choices(input, "platforms", PLATFORMS, errors, {
    empty: "Choose at least one platform.",
    invalid: "Choose platforms from the list.",
  }).join(", ");
  values.rank = text(input, "rank", GAMING_LIMITS.rank, errors);
  values.main_character = text(
    input,
    "main_character",
    GAMING_LIMITS.main_character,
    errors,
  );
  values.main_role = text(input, "main_role", GAMING_LIMITS.main_role, errors);
  values.play_style = choice(
    input,
    "play_style",
    PLAY_STYLES,
    errors,
    "Choose a play style from the list.",
  );
  values.voice_chat = choice(
    input,
    "voice_chat",
    VOICE_CHAT,
    errors,
    "Choose how you like to communicate.",
  );
  values.availability = text(
    input,
    "availability",
    GAMING_LIMITS.availability,
    errors,
  );
  return { values, errors };
}

// ---------- Dating preferences ----------

export function validateDatingPreferences(body: unknown) {
  const values = {} as Omit<DatingPreferences, "user_id">;
  const input = asBody(body);
  if (!input) return { values, ...invalidBody("Submit your dating preferences.") };
  const errors: Errors = {};

  const interests = choices(input, "interested_in", DATING_INTERESTS, errors, {
    empty: "Choose who you're interested in.",
    invalid: "Choose from the options in the list.",
  });
  // "Everyone" already covers the other options.
  values.interested_in = interests.includes("Everyone")
    ? "Everyone"
    : interests.join(", ");

  const ageMessage = `Enter a whole-number age from ${MIN_DATING_AGE} to ${MAX_DATING_AGE}.`;
  for (const field of ["age_min", "age_max"] as const) {
    const age = wholeNumber(input[field]);
    if (!(age >= MIN_DATING_AGE && age <= MAX_DATING_AGE))
      errors[field] = ageMessage;
    else values[field] = age;
  }
  if (!errors.age_min && !errors.age_max && values.age_min > values.age_max)
    errors.age_max = "The oldest age can't be lower than the youngest.";

  values.looking_for =
    choice(
      input,
      "looking_for",
      DATING_GOALS,
      errors,
      "Choose what you're looking for.",
    ) ?? "";
  return { values, errors };
}
