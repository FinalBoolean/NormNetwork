import type { ProfileInput } from "../src/profile.js";

const limits = {
  class: 10,
  gender: 20,
  major: 255,
  bio: 2000,
  profile_picture: 2048,
} as const;

export function validateProfile(body: unknown, partial = false) {
  const errors: Record<string, string> = {};
  const values: Partial<ProfileInput> = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      values,
      errors: { form: "Submit a profile object." } as Record<string, string>,
    };
  }
  const input = body as Record<string, unknown>;
  for (const field of Object.keys(limits) as (keyof typeof limits)[]) {
    if (partial && !Object.hasOwn(input, field)) continue;
    const optional = field === "bio" || field === "profile_picture";
    const raw = input[field];
    if (optional && (raw === undefined || raw === null || raw === "")) {
      values[field] = null;
      continue;
    }
    if (typeof raw !== "string" || (!optional && !raw.trim())) {
      errors[field] = "Enter a valid value.";
      continue;
    }
    const value = raw.trim();
    if (value.length > limits[field]) {
      errors[field] = `Use at most ${limits[field]} characters.`;
      continue;
    }
    if (field === "profile_picture" && value) {
      try {
        const url = new URL(value);
        if (
          !["https:", "http:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          throw new Error();
      } catch {
        errors[field] = "Enter a full http or https image URL.";
        continue;
      }
    }
    if (field === "bio" || field === "profile_picture")
      values[field] = value || null;
    else values[field] = value;
  }
  if (!partial || Object.hasOwn(input, "age")) {
    const raw = input.age;
    const age =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && /^\d+$/.test(raw.trim())
          ? Number(raw)
          : NaN;
    if (!Number.isInteger(age) || age < 1 || age > 120)
      errors.age = "Enter a whole-number age between 1 and 120.";
    else values.age = age;
  }
  if (partial && !Object.keys(values).length && !Object.keys(errors).length)
    errors.form = "Provide at least one profile field to update.";
  return { values, errors };
}
