type ErrorPageProps = {
  status?: number;
  message?: string;
};

export default function ErrorPage({
  status = 500,
  message = "Something went wrong.",
}: ErrorPageProps) {
  const notFound = status === 404;

  return (
    <div className="join-page error-page">
      <header className="join-nav">
        <a className="join-brand" href="/">
          <span className="join-brand-emblem" aria-hidden="true">
            <img
              src="/assets/join/brand-network.svg"
              alt=""
              width={25}
              height={25}
            />
          </span>
          <span>norm’s network</span>
        </a>
        <a className="join-btn join-btn-secondary" href="/">
          Back to home
        </a>
      </header>

      <main className="error-workspace">
        <section className="error-card" aria-labelledby="error-title">
          <p className="error-status">{status}</p>
          <div className="error-motto">
            <span className="join-accent-line" aria-hidden="true" />
            <p>{notFound ? "LOST ON CAMPUS" : "TECHNICAL TIMEOUT"}</p>
          </div>
          <h1 id="error-title">
            {notFound ? "Page not found" : "Something went wrong"}
          </h1>
          <p className="error-message">{message}</p>
          <div className="error-actions">
            <a className="join-btn join-btn-primary error-action-btn" href="/">
              <img
                src="/assets/join/arrow-right.svg"
                alt=""
                width={20}
                height={20}
                aria-hidden="true"
              />
              Back to home
            </a>
            {!notFound && (
              <a className="join-btn join-btn-secondary" href="/threads">
                Browse threads
              </a>
            )}
          </div>
          <p className="error-assurance">
            <img
              src="/assets/join/shield.svg"
              alt=""
              width={20}
              height={20}
              aria-hidden="true"
            />
            Real students. No dating pressure.
          </p>
        </section>
      </main>
    </div>
  );
}
