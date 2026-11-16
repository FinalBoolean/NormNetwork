// Shared by the browser and the server: what the Study Buddy Finder shows.

/** Study buddies shown per page. */
export const STUDY_FINDER_PAGE_SIZE = 10;
/** Longest search text accepted in ?q=. */
export const STUDY_SEARCH_MAX = 100;

/**
 * One student on the Study Buddy Finder. Only details students chose to share
 * for studying are included: no email, age, or gender.
 */
export interface StudyMatch {
  user_id: number;
  username: string;
  class: string;
  major: string;
  bio: string | null;
  subject: string;
  /** Every course on their study partner profile, e.g. ["ITSC 2214", "ITSC 3155"] */
  courses: string[];
  /** The courses they share with the student who is looking */
  shared_courses: string[];
  additional_info: string | null;
  availability: string | null;
  meeting_place: string | null;
  /** URL of their profile photo, or null if they haven't uploaded one */
  photo: string | null;
}

export interface StudyFinderData {
  matches: StudyMatch[];
  /** Search text from ?q= */
  q: string;
  /** Course filter from ?course=, normalized like "ITSC 3155" */
  course: string;
  page: number;
  hasMore: boolean;
  /** The looking student's own courses, used as quick filters */
  myCourses: string[];
  /** Whether other students can find the looking student here */
  discoverable: boolean;
}

/** Link to the Study Buddy Finder with the given filters. */
export function studyFinderHref({
  q = "",
  course = "",
  page = 1,
}: {
  q?: string;
  course?: string;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (course) params.set("course", course);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/finder/study?${query}` : "/finder/study";
}
