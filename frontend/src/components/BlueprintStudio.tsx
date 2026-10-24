import { useEffect, useRef, useState } from "react";
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
}

interface BlueprintStudioProps {
  hintPills: string[];
  problemId: string;
  spec: BlueprintSpec;
  isPublishing: boolean;
  publishError: string | null;
  onChange(spec: BlueprintSpec): void;
  onPublish(draft: PublishDraft): Promise<void>;
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

type MermaidApi = typeof import("mermaid").default;

let mermaidPromise: Promise<MermaidApi> | null = null;
let renderSequence = 0;

async function getMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "dark" });
      return mermaid;
    });
  }
  return mermaidPromise;
}

async function renderMermaid(source: string): Promise<string> {
  const mermaid = await getMermaid();
  const result = await mermaid.render(`bridge-builder-diagram-${++renderSequence}`, source);
  return result.svg;
}

function appendHint(current: string, hint: string): string {
  return current.trim() ? `${current}\n${hint}` : hint;
}

/** Appends Mermaid-generated SVG without treating model text as HTML. */
function MermaidDiagram({ svg }: { svg: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
    const diagram = parsed.documentElement;
    if (diagram.nodeName.toLowerCase() === "parsererror") return;

    container.replaceChildren(diagram);
  }, [svg]);

  return (
    <div
      className="blueprint-preview__diagram"
      data-testid="mermaid-diagram"
      ref={containerRef}
      role="img"
      aria-label="Generated architecture diagram"
    />
  );
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
}: BlueprintStudioProps) {
  const [activeField, setActiveField] = useState<BlueprintField>("api");
  const [selectedHint, setSelectedHint] = useState<string | null>(null);
  const [diagram, setDiagram] = useState<RenderedDiagram | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function updateField(field: BlueprintField, value: string) {
    onChange({ ...spec, [field]: value });
  }

  function useHint(hint: string) {
    setSelectedHint(hint);
    updateField(activeField, appendHint(spec[activeField], hint));
  }

  const hasDraft = Object.values(spec).some((value) => value.trim());

  function publishSolution() {
    if (!diagram || !hasDraft || isPublishing) return;
    void onPublish({ spec, mermaid: diagram.source });
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
          <p className="hub__eyebrow">Draft your design</p>
          <h2 id="studio-title">Blueprint Studio</h2>
          <p>Use the prompts to explain your reasoning. There is no single correct architecture.</p>
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
            disabled={!diagram || !hasDraft || isPublishing}
            onClick={publishSolution}
            type="button"
          >
            {isPublishing ? "Publishing…" : "Publish Solution"}
          </button>
          {!diagram && <p className="blueprint-preview__source">Generate a blueprint before publishing.</p>}
          {diagram && !hasDraft && <p className="blueprint-preview__source">Add design notes before publishing.</p>}
        </aside>
      </div>
    </section>
  );
}
