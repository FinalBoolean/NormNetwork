import {
  COMPANION_INFO,
  COMPANION_TYPES,
  MAX_COURSES,
  MIN_DATING_AGE,
  STUDY_LIMITS,
  type CompanionType,
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
