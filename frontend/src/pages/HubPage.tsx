import { useEffect, useState } from "react";
import { api, type ProblemSummary } from "../api";
import { ProblemCard } from "../components/ProblemCard";
import type { Session } from "../session";

type HubState =
  | { kind: "loading" }
  | { kind: "ready"; problems: ProblemSummary[] }
  | { kind: "error"; message: string };

interface HubPageProps {
  session: Session;
}

/** Hub dashboard: weekly challenge first, then a persistent problem library. */
export function HubPage({ session }: HubPageProps) {
  const [state, setState] = useState<HubState>({ kind: "loading" });
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    api
      .listProblems()
      .then((problems) => {
        if (active) setState({ kind: "ready", problems });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Could not load problems.";
        if (active) setState({ kind: "error", message });
      });

    return () => {
      active = false;
    };
  }, [requestVersion]);

  if (state.kind === "loading") {
    return (
      <section className="hub hub--status" aria-busy="true" aria-labelledby="hub-loading-title">
        <p className="hub__eyebrow">Bridge Builder Hub</p>
        <h1 id="hub-loading-title">Finding problems worth building.</h1>
        <p role="status">Loading the weekly challenge and persistent problem library…</p>
      </section>
    );
  }

  if (state.kind === "error") {
    return (
      <section className="hub hub--status" aria-labelledby="hub-error-title">
        <p className="hub__eyebrow">Bridge Builder Hub</p>
        <h1 id="hub-error-title">The problem library is unavailable.</h1>
        <div className="hub-error" role="alert">
          <p>{state.message}</p>
          <button className="button button--secondary" onClick={() => setRequestVersion((v) => v + 1)}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  const weekly = state.problems.find((problem) => problem.isWeekly);
  const persistent = state.problems.filter((problem) => !problem.isWeekly);

  return (
    <div className="hub">
      <header className="hub__intro">
        <p className="hub__eyebrow">Bridge Builder Hub</p>
        <h1>Welcome back, {session.nickname}.</h1>
        <p>
          Start with a small, real-world system problem. Publish your thinking, learn from
          other blueprints, and make progress visible.
        </p>
      </header>

      <section className="hub__section" aria-labelledby="weekly-heading">
        <div className="hub__section-heading">
          <div>
            <p className="hub__eyebrow">This week</p>
            <h2 id="weekly-heading">Weekly Challenge</h2>
          </div>
          <span className="hub__role-badge">{session.role === "pro" ? "Industry Pro" : "Student"}</span>
        </div>

        {weekly ? (
          <ProblemCard featured problem={weekly} />
        ) : (
          <div className="hub-empty">
            <h3>A new weekly challenge is being prepared.</h3>
            <p>Pick a persistent problem below while the next challenge is queued.</p>
          </div>
        )}
      </section>

      <section className="hub__section" aria-labelledby="persistent-heading">
        <div className="hub__section-heading">
          <div>
            <p className="hub__eyebrow">Keep building</p>
            <h2 id="persistent-heading">Persistent Problems</h2>
          </div>
          <p className="hub__section-note">Open a problem, draft a blueprint, then share it.</p>
        </div>

        {persistent.length > 0 ? (
          <div className="problem-grid">
            {persistent.map((problem) => (
              <ProblemCard key={problem.id} problem={problem} />
            ))}
          </div>
        ) : (
          <div className="hub-empty">
            <h3>No persistent problems are available yet.</h3>
            <p>Check back soon for a new way to practice and contribute.</p>
          </div>
        )}
      </section>
    </div>
  );
}
