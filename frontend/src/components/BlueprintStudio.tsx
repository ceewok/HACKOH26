import { useEffect, useRef, useState } from "react";
import { MermaidDiagram, renderMermaid } from "./MermaidPreview";
import { api, ApiClientError, type DiagramSpec } from "../api";

export type BlueprintSpec = DiagramSpec;

export const emptyBlueprintSpec: BlueprintSpec = {
  api: "",
  processing: "",
  storage: "",
  bottlenecks: "",
};

type BlueprintField = keyof BlueprintSpec;

export interface PublishDraft {
  spec: BlueprintSpec;
  mermaid: string;
  tweakNote?: string;
}

/** When present, the Studio is forking an existing solution (Task 9). */
export interface TweakContext {
  /** The parent solution being tweaked. */
  parentSolutionId: string;
  /** Author nickname of the parent, shown for context. */
  parentAuthor: string;
  /** The parent's last-published diagram, pre-loaded as the starting preview. */
  parentMermaid: string;
}

interface BlueprintStudioProps {
  hintPills: string[];
  problemId: string;
  spec: BlueprintSpec;
  isPublishing: boolean;
  publishError: string | null;
  onChange(spec: BlueprintSpec): void;
  onPublish(draft: PublishDraft): Promise<void>;
  tweak?: TweakContext;
}

interface RenderedDiagram {
  source: string;
  svg: string;
}

const fields: Array<{ key: BlueprintField; label: string; prompt: string }> = [
  {
    key: "api",
    label: "API & Ingestion",
    prompt: "How do clients talk to the system? Name entry points, request flows, and live connections.",
  },
  {
    key: "processing",
    label: "Core Processing",
    prompt: "Which services do the work? Explain how requests, events, and business rules move.",
  },
  {
    key: "storage",
    label: "Data Storage & Caching",
    prompt: "Where does data live, how is it indexed, and what benefits from caching?",
  },
  {
    key: "bottlenecks",
    label: "Bottlenecks & Failure Modes",
    prompt: "What breaks first at ten times the load, and how would your design respond?",
  },
];

function appendHint(current: string, hint: string): string {
  return current.trim() ? `${current}\n${hint}` : hint;
}

/** Guided spec + on-demand Bedrock/Mermaid preview. */
export function BlueprintStudio({
  hintPills,
  problemId,
  spec,
  isPublishing,
  publishError,
  onChange,
  onPublish,
  tweak,
}: BlueprintStudioProps) {
  const [activeField, setActiveField] = useState<BlueprintField>("api");
  const [selectedHint, setSelectedHint] = useState<string | null>(null);
  const [diagram, setDiagram] = useState<RenderedDiagram | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [tweakNote, setTweakNote] = useState("");
  const requestVersion = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // When tweaking, pre-load the parent's diagram so the preview is populated and
  // the user can publish immediately after editing, without re-generating.
  useEffect(() => {
    if (!tweak?.parentMermaid) return;
    let active = true;
    renderMermaid(tweak.parentMermaid)
      .then((svg) => {
        if (active && mounted.current) {
          setDiagram((current) => current ?? { source: tweak.parentMermaid, svg });
        }
      })
      .catch(() => {
        /* A bad parent diagram just leaves the preview empty; Update Blueprint still works. */
      });
    return () => {
      active = false;
    };
  }, [tweak?.parentMermaid]);

  function updateField(field: BlueprintField, value: string) {
    onChange({ ...spec, [field]: value });
  }

  function useHint(hint: string) {
    setSelectedHint(hint);
    updateField(activeField, appendHint(spec[activeField], hint));
  }

  const hasDraft = Object.values(spec).some((value) => value.trim());
  const isTweak = Boolean(tweak);
  const hasTweakNote = tweakNote.trim().length > 0;
  const canPublish = Boolean(diagram) && hasDraft && !isPublishing && (!isTweak || hasTweakNote);

  function publishSolution() {
    if (!diagram || !hasDraft || isPublishing) return;
    if (isTweak && !hasTweakNote) return;
    void onPublish({
      spec,
      mermaid: diagram.source,
      ...(isTweak ? { tweakNote: tweakNote.trim() } : {}),
    });
  }

  async function updateBlueprint() {
    const thisRequest = ++requestVersion.current;
    setIsGenerating(true);
    setDiagramError(null);

    try {
      const response = await api.generateDiagram(problemId, spec);
      const svg = await renderMermaid(response.mermaid);
      if (!mounted.current || thisRequest !== requestVersion.current) return;

      setDiagram({ source: response.mermaid, svg });
    } catch (error) {
      if (!mounted.current || thisRequest !== requestVersion.current) return;

      if (error instanceof ApiClientError) {
        setDiagramError(error.message);
      } else {
        setDiagramError(
          diagram
            ? "The generated diagram could not be rendered. Your previous preview is still available."
            : "The generated diagram could not be rendered. Refine your design and try again.",
        );
      }
    } finally {
      if (mounted.current && thisRequest === requestVersion.current) setIsGenerating(false);
    }
  }

  return (
    <section className="blueprint-studio" aria-labelledby="studio-title">
      <header className="blueprint-studio__header">
        <div>
          <p className="hub__eyebrow">{isTweak ? "Tweak this design" : "Draft your design"}</p>
          <h2 id="studio-title">{isTweak ? "Tweak Studio" : "Blueprint Studio"}</h2>
          {isTweak ? (
            <p>
              You're forking <strong>{tweak!.parentAuthor}</strong>'s blueprint. Edit the spec and
              diagram, then add a short note explaining what you changed and why.
            </p>
          ) : (
            <p>Use the prompts to explain your reasoning. There is no single correct architecture.</p>
          )}
        </div>
      </header>

      <div className="studio-layout">
        <form className="studio-form" aria-label="Guided system design specification">
          <section className="hint-tray" aria-labelledby="hint-tray-title">
            <div>
              <h3 id="hint-tray-title">Building-block hints</h3>
              <p>Choose a hint to add it to the active section.</p>
            </div>
            {hintPills.length > 0 ? (
              <div className="hint-tray__pills">
                {hintPills.map((hint) => (
                  <button
                    aria-pressed={selectedHint === hint}
                    className="hint-pill"
                    key={hint}
                    onClick={() => useHint(hint)}
                    type="button"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            ) : (
              <p className="hint-tray__empty">No suggested building blocks were provided for this problem.</p>
            )}
          </section>

          <div className="studio-fields">
            {fields.map((field) => (
              <label className="studio-field" htmlFor={`blueprint-${field.key}`} key={field.key}>
                <span className="studio-field__label">{field.label}</span>
                <span className="studio-field__prompt">{field.prompt}</span>
                <textarea
                  id={`blueprint-${field.key}`}
                  onChange={(event) => updateField(field.key, event.target.value)}
                  onFocus={() => setActiveField(field.key)}
                  placeholder="Write your approach here…"
                  value={spec[field.key]}
                />
              </label>
            ))}
          </div>

          {isTweak && (
            <label className="studio-field studio-field--tweak" htmlFor="blueprint-tweak-note">
              <span className="studio-field__label">Why I tweaked this</span>
              <span className="studio-field__prompt">
                One line the community will see on {tweak!.parentAuthor}'s design linking back to your fork.
              </span>
              <textarea
                id="blueprint-tweak-note"
                onChange={(event) => setTweakNote(event.target.value)}
                placeholder="e.g. Swapped the queue for streaming to cut tail latency."
                value={tweakNote}
                maxLength={280}
              />
            </label>
          )}
        </form>

        <aside className="blueprint-preview" aria-labelledby="preview-title">
          <div className="blueprint-preview__heading">
            <div>
              <p className="hub__eyebrow">Architecture view</p>
              <h2 id="preview-title">Blueprint Preview</h2>
            </div>
            <button
              className="button button--primary"
              disabled={isGenerating}
              onClick={updateBlueprint}
              type="button"
            >
              {isGenerating ? "Updating…" : "Update Blueprint"}
            </button>
          </div>

          {diagram ? (
            <MermaidDiagram svg={diagram.svg} />
          ) : (
            <div className="blueprint-preview__placeholder" role="region" aria-label="Diagram preview pending">
              <h3>Ready to map your architecture.</h3>
              <p>
                Fill in your design notes, then choose Update Blueprint to generate a Mermaid
                architecture diagram.
              </p>
            </div>
          )}

          {isGenerating && <p className="blueprint-preview__status" role="status">Generating your diagram…</p>}
          {diagramError && <p className="blueprint-preview__error" role="alert">{diagramError}</p>}
          {publishError && <p className="blueprint-preview__error" role="alert">{publishError}</p>}
          {diagram && <p className="blueprint-preview__source">Mermaid source stored for this preview.</p>}
          <button
            className="button button--primary"
            disabled={!canPublish}
            onClick={publishSolution}
            type="button"
          >
            {isPublishing ? "Publishing…" : isTweak ? "Publish Tweak" : "Publish Solution"}
          </button>
          {!diagram && <p className="blueprint-preview__source">Generate a blueprint before publishing.</p>}
          {diagram && !hasDraft && <p className="blueprint-preview__source">Add design notes before publishing.</p>}
          {diagram && hasDraft && isTweak && !hasTweakNote && (
            <p className="blueprint-preview__source">Add a short "why I tweaked this" note before publishing.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
