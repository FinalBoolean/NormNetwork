// Shared by the browser and the server: what students can look for, and the
// choices, limits, and record shapes for each kind of partner profile.

export const COMPANION_TYPES = ["friends", "study", "gaming", "dating"] as const;
export type CompanionType = (typeof COMPANION_TYPES)[number];

export const COMPANION_INFO: Record<
  CompanionType,
  { label: string; description: string }
> = {
  friends: {
    label: "Friends",
    description: "Meet Niners who share your interests.",
  },
  study: {
    label: "Study partners",
    description: "Pair up with students in your courses.",
  },
  gaming: {
    label: "Gaming partners",
    description: "Find teammates by game, rank, and role.",
  },
  dating: {
    label: "Dating",
    description: "Opt in to meet students who are open to dating.",
  },
};

/** Dating is only available to students this age or older. */
export const MIN_DATING_AGE = 18;

// ---------- Study partner profile ----------

export const MAX_COURSES = 5;
export const STUDY_LIMITS = {
  subject: 100,
  additional_info: 1000,
  availability: 100,
  meeting_place: 100,
} as const;

export interface StudyProfile {
  user_id: number;
  subject: string;
  course: string;
  additional_info: string | null;
  availability: string | null;
  meeting_place: string | null;
}

/** Splits a stored comma-separated list ("PC, Xbox") back into items. */
export function splitList(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
