import { useEffect, useRef, useState } from "react";

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

/** Render Mermaid only after it is needed, keeping it out of the initial bundle. */
export async function renderMermaid(source: string): Promise<string> {
  const mermaid = await getMermaid();
  const result = await mermaid.render(`bridge-builder-diagram-${++renderSequence}`, source);
  return result.svg;
}

/** Appends Mermaid-produced SVG without treating stored/model source as HTML. */
export function MermaidDiagram({ svg, label = "Generated architecture diagram" }: { svg: string; label?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
    const diagram = parsed.documentElement;
    if (diagram.nodeName.toLowerCase() === "parsererror") return;
    container.replaceChildren(diagram);
  }, [svg]);

  return <div className="blueprint-preview__diagram" data-testid="mermaid-diagram" ref={containerRef} role="img" aria-label={label} />;
}

/** Read-only persisted Mermaid source renderer for solution detail. */
export function MermaidSourcePreview({ source }: { source: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSvg(null);
    setError(null);
    renderMermaid(source)
      .then((nextSvg) => {
        if (active) setSvg(nextSvg);
      })
      .catch(() => {
        if (active) setError("This saved diagram could not be rendered.");
      });
    return () => {
      active = false;
    };
  }, [source]);

  if (error) return <p className="blueprint-preview__error" role="alert">{error}</p>;
  if (!svg) return <p className="blueprint-preview__status" role="status">Rendering saved diagram…</p>;
  return <MermaidDiagram svg={svg} label="Saved solution architecture diagram" />;
}
