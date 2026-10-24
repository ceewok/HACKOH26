import { Link, useParams } from "react-router-dom";

/**
 * Navigation destination for Task 3 cards. Task 4 replaces this with the full
 * problem detail and Blueprint Studio while preserving the route contract.
 */
export function ProblemRoutePlaceholder() {
  const { id } = useParams();

  return (
    <section className="problem-placeholder" aria-labelledby="problem-placeholder-title">
      <p className="hub__eyebrow">Problem selected</p>
      <h1 id="problem-placeholder-title">Your Blueprint Studio is next.</h1>
      <p>
        You selected <code>{id}</code>. Task 4 adds the complete brief, hint pills, and guided
        architecture workspace here.
      </p>
      <Link className="button button--secondary" to="/">
        Back to the Hub
      </Link>
    </section>
  );
}
