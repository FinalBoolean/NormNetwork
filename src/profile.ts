export const CLASS_STANDINGS = [
  "Freshman",
  "Sophomore",
  "Junior",
  "Senior",
  "Graduate",
  "Other",
] as const;
export const GENDERS = [
  "Woman",
  "Man",
  "Non-binary",
  "Other",
  "Prefer not to say",
] as const;
export const MIN_PROFILE_AGE = 16;
export const MAX_PROFILE_AGE = 100;

export interface Profile {
  id: number;
  user_id: number;
  profile_picture: string | null;
  bio: string | null;
  age: number;
  class: string;
  gender: string;
  major: string;
}

export type ProfileInput = Omit<Profile, "id" | "user_id">;
