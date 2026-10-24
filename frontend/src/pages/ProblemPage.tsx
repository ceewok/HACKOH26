import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiClientError, type Author, type Problem } from "../api";
import {
  BlueprintStudio,
  emptyBlueprintSpec,
  type BlueprintSpec,
  type PublishDraft,
} from "../components/BlueprintStudio";

type ProblemPageState =
  | { kind: "loading" }
  | { kind: "ready"; problem: Problem }
  | { kind: "error"; code: string; message: string };

interface ProblemPageProps {
  author: Author;
}

/** Full problem brief, guided Studio, diagram generation, and public publication flow. */
export function ProblemPage({ author }: ProblemPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<ProblemPageState>({ kind: "loading" });
  const [requestVersion, setRequestVersion] = useState(0);
  const [spec, setSpec] = useState<BlueprintSpec>(emptyBlueprintSpec);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

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

  async function publishSolution(draft: PublishDraft) {
    if (state.kind !== "ready") return;

    setIsPublishing(true);
    setPublishError(null);
    try {
      const response = await api.publishSolution({
        problemId: state.problem.id,
        author,
        spec: draft.spec,
        mermaid: draft.mermaid,
      });
      navigate(`/solutions/${encodeURIComponent(response.solution.id)}`, {
        state: { solution: response.solution },
      });
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Could not publish your solution.");
    } finally {
      setIsPublishing(false);
    }
  }

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
        isPublishing={isPublishing}
        onChange={setSpec}
        onPublish={publishSolution}
        problemId={problem.id}
        publishError={publishError}
        spec={spec}
      />
    </article>
  );
}
