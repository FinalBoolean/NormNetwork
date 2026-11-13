import type { ColumnType, Generated } from "kysely";

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface Database {
  profile_photos: { profile_id: number; image: Buffer };
  sessions: {
    token_hash: string;
    user_id: number;
    created_at: Timestamp;
    expires_at: ColumnType<Date, Date | string, Date | string>;
  };
  users: {
    id: Generated<number>;
    username: string;
    password_hash: string;
    email: string;
    created_at: Timestamp;
  };
  profiles: {
    id: Generated<number>;
    user_id: number;
    profile_picture: string | null;
    bio: string | null;
    age: number;
    class: string;
    gender: string;
    major: string;
  };
  friend_finder: {
    user_id: number;
    interest: string;
    preferred_gender: string;
  };
  companion_types: {
    user_id: number;
    type: string;
  };
  study_finder: {
    user_id: number;
    subject: string;
    course: string;
    additional_info: string | null;
  };
  gaming_finder: {
    user_id: number;
    games: string;
    rank: string | null;
    main_character: string | null;
    main_role: string | null;
  };
  threads: {
    id: Generated<number>;
    profile_id: number;
    category: string;
    title: string;
    body: string;
    created_at: Timestamp;
    updated_at: Timestamp;
  };
  threads_reply: {
    id: Generated<number>;
    thread_id: number;
    profile_id: number;
    body: string;
    created_at: Timestamp;
  };
  friend_request: {
    id: Generated<number>;
    sender_id: number;
    receiver_id: number;
    status: Generated<string>;
    created_at: Timestamp;
  };
  friends: {
    profile_a_id: number;
    profile_b_id: number;
    created_at: Timestamp;
  };
}
