import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiClientError, type Feedback, type SolutionDetail } from "../api";
import { MermaidSourcePreview } from "../components/MermaidPreview";
import { getSession } from "../session";

type DetailState =
  | { kind: "loading" }
  | { kind: "ready"; solution: SolutionDetail }
  | { kind: "error"; code: string; message: string };

/** Reloadable public solution detail with public feedback + pro endorsement. */
export function PublishedSolutionPage() {
  const { id } = useParams();
  const [state, setState] = useState<DetailState>({ kind: "loading" });
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    if (!id) {
      setState({ kind: "error", code: "bad_request", message: "A solution id is required." });
      return;
    }

    let active = true;
    setState({ kind: "loading" });
    api
      .getSolution(id)
      .then((solution) => {
        if (active) setState({ kind: "ready", solution });
      })
      .catch((error: unknown) => {
        const code = error instanceof ApiClientError ? error.code : "error";
        const message = error instanceof Error ? error.message : "Could not load this solution.";
        if (active) setState({ kind: "error", code, message });
      });
    return () => {
      active = false;
    };
  }, [id, requestVersion]);

  if (state.kind === "loading") {
    return (
      <section className="published-solution" aria-busy="true" aria-labelledby="solution-loading-title">
        <p className="hub__eyebrow">Public blueprint</p>
        <h1 id="solution-loading-title">Loading this solution.</h1>
        <p role="status">Getting the design, diagram, and community context…</p>
      </section>
    );
  }

  if (state.kind === "error") {
    const missing = state.code === "not_found";
    return (
      <section className="published-solution" aria-labelledby="solution-error-title">
        <p className="hub__eyebrow">Public blueprint</p>
        <h1 id="solution-error-title">{missing ? "This solution is not available." : "The solution is unavailable."}</h1>
        <div className="hub-error" role="alert">
          <p>{state.message}</p>
          <div className="problem-page__actions">
            {!missing && <button className="button button--secondary" onClick={() => setRequestVersion((value) => value + 1)} type="button">Try again</button>}
            <Link className="button button--secondary" to="/">Back to the Hub</Link>
          </div>
        </div>
      </section>
    );
  }

  const { solution } = state;

  const applyFeedback = (feedback: Feedback, endorsedByPro: boolean) => {
    setState((current) =>
      current.kind === "ready"
        ? {
            kind: "ready",
            solution: {
              ...current.solution,
              feedback: [...current.solution.feedback, feedback],
              endorsedByPro,
            },
          }
        : current,
    );
  };

  return (
    <article className="solution-detail" aria-labelledby="solution-title">
      <Link className="problem-page__back" to={`/problems/${encodeURIComponent(solution.problemId)}`}>
        ← Back to problem
      </Link>

      <header className="solution-detail__header">
        <p className="hub__eyebrow">Public blueprint</p>
        <h1 id="solution-title">{solution.author.nickname}'s architecture</h1>
        <p>
          Published {new Date(solution.createdAt).toLocaleString()}
          {solution.author.company ? ` · ${solution.author.company}` : ""}
        </p>
        <div className="solution-card__meta">
          <span className={solution.author.role === "pro" ? "solution-badge solution-badge--pro" : "solution-badge"}>
            {solution.author.role === "pro" ? "Industry Pro" : "Student"}
          </span>
          {solution.endorsedByPro && <span className="solution-badge solution-badge--endorsed">Endorsed by a Pro</span>}
        </div>
      </header>

      <section className="solution-detail__diagram" aria-labelledby="solution-diagram-title">
        <h2 id="solution-diagram-title">Architecture diagram</h2>
        <MermaidSourcePreview source={solution.mermaid} />
      </section>

      <section className="solution-detail__spec" aria-labelledby="solution-spec-title">
        <h2 id="solution-spec-title">Design notes</h2>
        <dl>
          <div><dt>API & Ingestion</dt><dd>{solution.spec.api || "No notes provided."}</dd></div>
          <div><dt>Core Processing</dt><dd>{solution.spec.processing || "No notes provided."}</dd></div>
          <div><dt>Data Storage & Caching</dt><dd>{solution.spec.storage || "No notes provided."}</dd></div>
          <div><dt>Bottlenecks & Failure Modes</dt><dd>{solution.spec.bottlenecks || "No notes provided."}</dd></div>
        </dl>
      </section>

      <section className="solution-detail__community" aria-labelledby="solution-feedback-title">
        <h2 id="solution-feedback-title">Community feedback</h2>
        {solution.feedback.length > 0 ? (
          <ul className="feedback-list">
            {solution.feedback.map((feedback) => (
              <li key={feedback.id}>
                <strong>{feedback.author.nickname}</strong>
                {feedback.author.company ? ` · ${feedback.author.company}` : ""}
                {feedback.author.role === "pro" && (
                  <span className="solution-badge solution-badge--pro"> Industry Pro</span>
                )}
                <p>{feedback.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No feedback yet. Be the first to weigh in.</p>
        )}
        <FeedbackForm solutionId={solution.id} onSubmitted={applyFeedback} />
      </section>

      <section className="solution-detail__community" aria-labelledby="solution-tweaks-title">
        <h2 id="solution-tweaks-title">Community tweaks</h2>
        {solution.tweaks.length > 0 ? (
          <div className="solution-gallery__grid">
            {solution.tweaks.map((tweak) => (
              <Link className="solution-card" key={tweak.id} to={`/solutions/${encodeURIComponent(tweak.id)}`}>
                <h3>{tweak.author.nickname}'s tweak</h3>
                <p>{tweak.tweakNote || "A community refinement of this design."}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p>No tweaks yet. Task 9 adds the public fork-and-tweak flow.</p>
        )}
      </section>
    </article>
  );
}

type FeedbackFormProps = {
  solutionId: string;
  onSubmitted: (feedback: Feedback, endorsedByPro: boolean) => void;
};

/** Public feedback composer. A pro's feedback endorses the solution on the server. */
function FeedbackForm({ solutionId, onSubmitted }: FeedbackFormProps) {
  const session = getSession();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) {
    return (
      <p className="feedback-form__notice">
        <Link to="/">Set up your demo identity</Link> to leave feedback.
      </p>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await api.submitFeedback(solutionId, { author: session, text: trimmed });
      onSubmitted(result.feedback, result.endorsedByPro);
      setText("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save your feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="feedback-form" onSubmit={handleSubmit} aria-label="Leave public feedback">
      <label htmlFor="feedback-text">
        Feedback as <strong>{session.nickname}</strong>
        {session.role === "pro" ? ` · ${session.company} (Industry Pro)` : " (Student)"}
      </label>
      {session.role === "pro" && (
        <p className="feedback-form__hint">Your feedback endorses this design with a Pro badge.</p>
      )}
      <textarea
        id="feedback-text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="What's strong, and what would you push on?"
        rows={3}
        maxLength={1000}
        disabled={submitting}
      />
      {error && <p className="feedback-form__error" role="alert">{error}</p>}
      <button className="button button--primary" type="submit" disabled={submitting || !text.trim()}>
        {submitting ? "Posting…" : "Post feedback"}
      </button>
    </form>
  );
}
