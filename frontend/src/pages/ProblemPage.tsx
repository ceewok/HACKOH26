import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiClientError, type Problem } from "../api";
import { BlueprintStudio, emptyBlueprintSpec, type BlueprintSpec } from "../components/BlueprintStudio";

type ProblemPageState =
  | { kind: "loading" }
  | { kind: "ready"; problem: Problem }
  | { kind: "error"; code: string; message: string };

/** Full problem brief plus the guided, client-only Studio draft for Task 4. */
export function ProblemPage() {
  const { id } = useParams();
  const [state, setState] = useState<ProblemPageState>({ kind: "loading" });
  const [requestVersion, setRequestVersion] = useState(0);
  const [spec, setSpec] = useState<BlueprintSpec>(emptyBlueprintSpec);

  useEffect(() => {
    if (!id) {
      setState({ kind: "error", code: "bad_request", message: "A problem id is required." });
      return;
    }

    let active = true;
    setState({ kind: "loading" });
    api
      .getProblem(id)
      .then((problem) => {
        if (active) setState({ kind: "ready", problem });
      })
      .catch((error: unknown) => {
        const code = error instanceof ApiClientError ? error.code : "error";
        const message = error instanceof Error ? error.message : "Could not load this problem.";
        if (active) setState({ kind: "error", code, message });
      });

    return () => {
      active = false;
    };
  }, [id, requestVersion]);

  if (state.kind === "loading") {
    return (
      <section className="problem-page problem-page--status" aria-busy="true" aria-labelledby="problem-loading-title">
        <p className="hub__eyebrow">Problem workspace</p>
        <h1 id="problem-loading-title">Loading the design brief.</h1>
        <p role="status">Getting the constraints and suggested building blocks…</p>
      </section>
    );
  }

  if (state.kind === "error") {
    const missing = state.code === "not_found";
    return (
      <section className="problem-page problem-page--status" aria-labelledby="problem-error-title">
        <p className="hub__eyebrow">Problem workspace</p>
        <h1 id="problem-error-title">{missing ? "This problem is not available." : "The design brief is unavailable."}</h1>
        <div className="hub-error" role="alert">
          <p>{state.message}</p>
          <div className="problem-page__actions">
            {!missing && (
              <button className="button button--secondary" onClick={() => setRequestVersion((v) => v + 1)}>
                Try again
              </button>
            )}
            <Link className="button button--secondary" to="/">
              Back to the Hub
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const { problem } = state;
  return (
    <article className="problem-page" aria-labelledby="problem-title">
      <Link className="problem-page__back" to="/">
        ← Back to the Hub
      </Link>

      <header className="problem-brief">
        <p className="hub__eyebrow">{problem.isWeekly ? "Weekly challenge" : "Persistent problem"}</p>
        <h1 id="problem-title">{problem.title}</h1>
        <p className="problem-brief__hook">{problem.hook}</p>
        <p className="problem-brief__description">{problem.description}</p>
      </header>

      <section className="problem-constraints" aria-labelledby="constraints-title">
        <h2 id="constraints-title">Design constraints</h2>
        {problem.constraints.length > 0 ? (
          <ul>
            {problem.constraints.map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>
        ) : (
          <p>No constraints were provided. Define the trade-offs you want to explore.</p>
        )}
      </section>

      <BlueprintStudio
        hintPills={problem.hintPills}
        onChange={setSpec}
        problemId={problem.id}
        spec={spec}
      />
    </article>
  );
}
