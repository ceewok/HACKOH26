import { Link } from "react-router-dom";
import type { ProblemSummary } from "../api";

interface ProblemCardProps {
  problem: ProblemSummary;
  featured?: boolean;
}

/** A single Hub entry point into a problem; details belong to the next route. */
export function ProblemCard({ problem, featured = false }: ProblemCardProps) {
  return (
    <Link
      aria-label={`Open ${problem.title}`}
      className={`problem-card ${featured ? "problem-card--featured" : ""}`}
      to={`/problems/${encodeURIComponent(problem.id)}`}
    >
      <span className="problem-card__label">
        {featured ? "Weekly challenge" : "Persistent problem"}
      </span>
      <h3>{problem.title}</h3>
      <p>{problem.hook}</p>
      <span className="problem-card__action" aria-hidden="true">
        Explore problem →
      </span>
    </Link>
  );
}
