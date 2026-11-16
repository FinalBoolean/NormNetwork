export interface DiscoveryPerson {
  profileId: number;
  username: string;
  age: number;
  class: string;
  major: string;
  bio: string | null;
  profilePicture: string | null;
  connection: "none" | "sent" | "incoming" | "friends";
  requestId: number | null;
}

export interface DiscoveryData {
  people: DiscoveryPerson[];
  query: string;
  page: number;
  hasNext: boolean;
  hasProfile: boolean;
}

export interface ConnectionsData {
  incoming: DiscoveryPerson[];
  outgoing: DiscoveryPerson[];
  friends: DiscoveryPerson[];
  hasProfile: boolean;
}
