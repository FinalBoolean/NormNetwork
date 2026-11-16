import { PHOTO_URL } from "./profile-photo.js";
import type {
  HiddenField,
  ProfileVisibility,
  PublicProfile,
} from "../src/profile.js";

export interface ProfileRecord {
  id: number;
  user_id: number;
  username: string;
  profile_picture: string | null;
  bio: string | null;
  age: number;
  class: string;
  gender: string;
  major: string;
  visibility: string;
  show_age: boolean;
  show_gender: boolean;
  show_bio: boolean;
}

function visibilityOf(value: string): ProfileVisibility {
  if (value === "campus" || value === "friends" || value === "private")
    return value;
  // An unexpected stored value stays hidden rather than becoming public.
  return "private";
}

function publicPhoto(profile: ProfileRecord) {
  const picture = profile.profile_picture;
  if (!picture) return null;
  if (picture === PHOTO_URL)
    return `/users/${encodeURIComponent(profile.username)}/photo`;
  try {
    const url = new URL(picture);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Profile another signed-in student is allowed to see.
 * Returns null when the profile is private to that student.
 * The owner always receives every field.
 */
export function presentProfile(
  profile: ProfileRecord,
  viewer: { userId: number; friendProfileIds: ReadonlySet<number> },
): PublicProfile | null {
  const isOwner = profile.user_id === viewer.userId;
  const visibility = visibilityOf(profile.visibility);
  if (!isOwner && visibility === "private") return null;

  const friendsOnly =
    !isOwner && visibility === "friends" && !viewer.friendProfileIds.has(profile.id);
  const hidden: HiddenField[] = [];
  if (!isOwner && (friendsOnly || !profile.show_age)) hidden.push("age");
  if (!isOwner && (friendsOnly || !profile.show_gender)) hidden.push("gender");
  if (!isOwner && (friendsOnly || !profile.show_bio)) hidden.push("bio");

  const person: PublicProfile = {
    username: profile.username,
    major: profile.major,
    class: profile.class,
    profile_picture: publicPhoto(profile),
    hidden,
    friendsOnly,
  };
  if (!hidden.includes("age")) person.age = profile.age;
  if (!hidden.includes("gender")) person.gender = profile.gender;
  if (!hidden.includes("bio")) person.bio = profile.bio;
  return person;
}
