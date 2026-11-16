// Shared by the browser and the server: what a Friend Finder card shows about a student.
import type { HiddenField } from "./profile.js";

/** Most students shown on one finder page. */
export const FINDER_LIMIT = 20;

/** Public profile fields, already filtered by the student's privacy settings. */
export interface FriendCandidate {
  kind: "friends";
  profileId: number;
  username: string;
  class: string;
  major: string;
  profilePicture: string | null;
  age?: number;
  bio?: string | null;
  hidden: HiddenField[];
  /** Interests this student has in common with the viewer. */
  shared: string[];
  interests: string[];
}

export type FinderCandidate = FriendCandidate;

/** What the Friend Finder page receives from the server. */
export interface FinderData {
  /** False for logged-out visitors, who see a sign-in prompt instead of students. */
  signedIn: boolean;
  /** False when the viewer hasn't saved a main profile, so Connect can't work yet. */
  hasProfile: boolean;
  candidates: FinderCandidate[];
}
