import { useState } from "react";

export interface BlueprintSpec {
  api: string;
  processing: string;
  storage: string;
  bottlenecks: string;
}

export const emptyBlueprintSpec: BlueprintSpec = {
  api: "",
  processing: "",
  storage: "",
  bottlenecks: "",
};

type BlueprintField = keyof BlueprintSpec;

interface BlueprintStudioProps {
  hintPills: string[];
  spec: BlueprintSpec;
  onChange(spec: BlueprintSpec): void;
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

/** Structured drafting UI; Task 5 adds Bedrock + Mermaid to its preview pane. */
export function BlueprintStudio({ hintPills, spec, onChange }: BlueprintStudioProps) {
  const [activeField, setActiveField] = useState<BlueprintField>("api");
  const [selectedHint, setSelectedHint] = useState<string | null>(null);

  function updateField(field: BlueprintField, value: string) {
    onChange({ ...spec, [field]: value });
  }

  function useHint(hint: string) {
    setSelectedHint(hint);
    updateField(activeField, appendHint(spec[activeField], hint));
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
          <p className="hub__eyebrow">Architecture view</p>
          <h2 id="preview-title">Blueprint Preview</h2>
          <div className="blueprint-preview__placeholder" role="region" aria-label="Diagram preview unavailable">
            <h3>Diagram generation connects next.</h3>
            <p>
              Keep drafting on the left. Task 5 will turn this structured spec into a Mermaid
              architecture diagram when you choose to update the blueprint.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
