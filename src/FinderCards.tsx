import { useState, type ReactNode } from "react";
import type { FinderCandidate, FinderData } from "./finder.js";

export const EMPTY_FINDER: FinderData = {
  signedIn: false,
  hasProfile: false,
  candidates: [],
};

/** Steps through candidates one card at a time; Pass only hides a card for this visit. */
export function useCandidates<T extends FinderCandidate>(candidates: T[]) {
  const [index, setIndex] = useState(0);
  return {
    current: candidates[index] as T | undefined,
    pass: () => setIndex((i) => i + 1),
  };
}

export function candidateName(candidate: FinderCandidate) {
  return candidate.age === undefined
    ? candidate.username
    : `${candidate.username}, ${candidate.age}`;
}

export function profileHref(candidate: FinderCandidate) {
  return `/users/${encodeURIComponent(candidate.username)}`;
}

export function CandidatePhoto({ candidate }: { candidate: FinderCandidate }) {
  const [failed, setFailed] = useState(false);
  return candidate.profilePicture && !failed ? (
    <img
      src={candidate.profilePicture}
      alt=""
      className="finder-card-img"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className="finder-card-img person-avatar-placeholder"
      aria-hidden="true"
    >
      {candidate.username.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** Sends a friend request and comes back to this finder with a notice. */
export function ConnectButton({
  candidate,
  hasProfile,
  returnTo,
  className = "finder-btn finder-btn-primary",
  children,
}: {
  candidate: FinderCandidate;
  hasProfile: boolean;
  returnTo: string;
  className?: string;
  children: ReactNode;
}) {
  if (!hasProfile)
    return (
      <a className={className} href="/profile" aria-label="Create your profile to connect">
        {children}
      </a>
    );
  return (
    <form method="post" action="/friends/requests" className="finder-connect-form">
      <input type="hidden" name="receiver_id" value={candidate.profileId} />
      <input type="hidden" name="returnTo" value={`${returnTo}?sent=1`} />
      <button
        type="submit"
        className={className}
        aria-label={`Connect with ${candidate.username}`}
      >
        {children}
      </button>
    </form>
  );
}

/**
 * Everything a finder shows instead of, or above, a student's card: the
 * sent notice, the sign-in and profile prompts, and the empty state.
 */
export function FinderStatus({
  finder,
  notice,
  hasCurrent,
  path,
  noun,
}: {
  finder: FinderData;
  notice?: string;
  hasCurrent: boolean;
  path: string;
  noun: string;
}) {
  const reachedEnd = finder.candidates.length > 0 && !hasCurrent;
  return (
    <>
      {notice && (
        <p className="profile-saved-notice" role="status">
          {notice}
        </p>
      )}
      {!finder.signedIn ? (
        <section className="discovery-empty">
          <h2>Log in to meet {noun}.</h2>
          <p>Only signed-in UNC Charlotte students can see who’s here.</p>
          <a
            className="finder-btn finder-btn-primary"
            href={`/login?next=${encodeURIComponent(path)}`}
          >
            Log in
          </a>
        </section>
      ) : (
        <>
          {!finder.hasProfile && (
            <div className="discovery-profile-prompt">
              <div>
                <h2>Let people get to know you.</h2>
                <p>Create your profile to send connection requests.</p>
              </div>
              <a className="finder-btn finder-btn-primary" href="/profile">
                Create your profile
              </a>
            </div>
          )}
          {!hasCurrent && (
            <section className="discovery-empty">
              <h2>
                {reachedEnd ? "You’ve seen everyone for now." : `No ${noun} yet.`}
              </h2>
              <p>
                {reachedEnd
                  ? "Check back later, or look around Discover."
                  : "When students turn this on in their profile, they’ll show up here."}
              </p>
              <a
                className="finder-btn finder-btn-secondary"
                href={reachedEnd ? path : "/discover"}
              >
                {reachedEnd ? "Start over" : "Browse Discover"}
              </a>
            </section>
          )}
        </>
      )}
    </>
  );
}
