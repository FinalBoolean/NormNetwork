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

export const VISIBILITIES = ["campus", "friends", "private"] as const;
export type ProfileVisibility = (typeof VISIBILITIES)[number];
export const HIDDEN_FIELDS = ["age", "gender", "bio"] as const;
export type HiddenField = (typeof HIDDEN_FIELDS)[number];

export const VISIBILITY_OPTIONS = [
  {
    value: "campus",
    label: "Campus",
    hint: "Any signed-in Niner can open your profile.",
  },
  {
    value: "friends",
    label: "Friends",
    hint: "Others see your name, year, major, and photo. Age, gender, and bio are only for friends.",
  },
  {
    value: "private",
    label: "Only me",
    hint: "Other Niners cannot open your profile.",
  },
] as const;

export interface Profile {
  id: number;
  user_id: number;
  profile_picture: string | null;
  bio: string | null;
  age: number;
  class: string;
  gender: string;
  major: string;
  visibility: ProfileVisibility;
  show_age: boolean;
  show_gender: boolean;
  show_bio: boolean;
}

/** What another signed-in student is allowed to see. Hidden fields are omitted. */
export interface PublicProfile {
  username: string;
  major: string;
  class: string;
  profile_picture: string | null;
  age?: number;
  gender?: string;
  bio?: string | null;
  hidden: HiddenField[];
  friendsOnly: boolean;
}

export type ProfileInput = Omit<Profile, "id" | "user_id">;
