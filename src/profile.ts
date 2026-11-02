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
