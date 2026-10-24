import { Link, useLocation, useParams } from "react-router-dom";
import type { Solution } from "../api";

interface LocationState {
  solution?: Solution;
}

/**
 * Task 6 post-publish destination. Task 7 replaces its navigation-state view
 * with a reloadable public solution detail page backed by GET /solutions/:id.
 */
export function PublishedSolutionPage() {
  const { id } = useParams();
  const state = useLocation().state as LocationState | null;
  const solution = state?.solution;

  if (!solution || solution.id !== id) {
    return (
      <section className="published-solution" aria-labelledby="published-title">
        <p className="hub__eyebrow">Solution workspace</p>
        <h1 id="published-title">Solution detail is loading next.</h1>
        <p>
          Your public solution was saved. Task 7 adds the reloadable detail page, gallery, and
          community feedback for this URL.
        </p>
        <Link className="button button--secondary" to="/">
          Back to the Hub
        </Link>
      </section>
    );
  }

  return (
    <section className="published-solution" aria-labelledby="published-title">
      <p className="hub__eyebrow">Published</p>
      <h1 id="published-title">Your solution is live.</h1>
      <p>
        <strong>{solution.author.nickname}</strong> published a blueprint for this problem.
      </p>
      <dl className="published-solution__summary">
        <div>
          <dt>Solution ID</dt>
          <dd>{solution.id}</dd>
        </div>
        <div>
          <dt>Published</dt>
          <dd>{new Date(solution.createdAt).toLocaleString()}</dd>
        </div>
      </dl>
      <p className="published-solution__note">
        Task 7 adds the reloadable public detail, gallery filters, and community discussion.
      </p>
      <div className="problem-page__actions">
        <Link className="button button--secondary" to={`/problems/${encodeURIComponent(solution.problemId)}`}>
          Back to problem
        </Link>
        <Link className="button button--primary" to="/">
          Explore more problems
        </Link>
      </div>
    </section>
  );
}
