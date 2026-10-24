import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type SolutionWithTweakCount } from "../api";

type GalleryRole = "all" | "pro" | "student";

const filters: Array<{ role: GalleryRole; label: string }> = [
  { role: "all", label: "All" },
  { role: "pro", label: "Industry Pros" },
  { role: "student", label: "Students" },
];

type GalleryState =
  | { kind: "loading" }
  | { kind: "ready"; solutions: SolutionWithTweakCount[] }
  | { kind: "error"; message: string };

export function SolutionGallery({ problemId }: { problemId: string }) {
  const [role, setRole] = useState<GalleryRole>("all");
  const [state, setState] = useState<GalleryState>({ kind: "loading" });
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    api
      .listSolutions(problemId, role)
      .then((solutions) => {
        if (active) setState({ kind: "ready", solutions });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Could not load solutions.";
        if (active) setState({ kind: "error", message });
      });
    return () => {
      active = false;
    };
  }, [problemId, role, requestVersion]);

  return (
    <section className="solution-gallery" aria-labelledby="solution-gallery-title">
      <div className="solution-gallery__heading">
        <div>
          <p className="hub__eyebrow">Learn from the community</p>
          <h2 id="solution-gallery-title">Published Blueprints</h2>
        </div>
        <div aria-label="Filter published blueprints" className="solution-gallery__filters" role="tablist">
          {filters.map((filter) => (
            <button
              aria-selected={role === filter.role}
              className={`solution-filter ${role === filter.role ? "solution-filter--selected" : ""}`}
              key={filter.role}
              onClick={() => setRole(filter.role)}
              role="tab"
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {state.kind === "loading" && <p className="solution-gallery__status" role="status">Loading published blueprints…</p>}

      {state.kind === "error" && (
        <div className="hub-error" role="alert">
          <p>{state.message}</p>
          <button className="button button--secondary" onClick={() => setRequestVersion((value) => value + 1)} type="button">
            Try again
          </button>
        </div>
      )}

      {state.kind === "ready" && state.solutions.length === 0 && (
        <div className="hub-empty">
          <h3>No blueprints match this filter yet.</h3>
          <p>Publish the first approach or switch filters to keep exploring.</p>
        </div>
      )}

      {state.kind === "ready" && state.solutions.length > 0 && (
        <div className="solution-gallery__grid">
          {state.solutions.map((solution) => (
            <Link className="solution-card" key={solution.id} to={`/solutions/${encodeURIComponent(solution.id)}`}>
              <div className="solution-card__meta">
                <span className={solution.author.role === "pro" ? "solution-badge solution-badge--pro" : "solution-badge"}>
                  {solution.author.role === "pro" ? "Industry Pro" : "Student"}
                </span>
                {solution.endorsedByPro && <span className="solution-badge solution-badge--endorsed">Endorsed by a Pro</span>}
              </div>
              <h3>{solution.author.nickname}'s blueprint</h3>
              {solution.author.company && <p className="solution-card__company">{solution.author.company}</p>}
              <p className="solution-card__date">Published {new Date(solution.createdAt).toLocaleDateString()}</p>
              <p className="solution-card__tweaks">{solution.tweakCount} community tweak{solution.tweakCount === 1 ? "" : "s"}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
