// Conservative Mermaid flowchart validator shared by generation and publication.
// This deliberately supports the small safe subset the Bedrock prompt requests.

const FLOWCHART_HEADER = /^(?:flowchart|graph)\s+(?:TB|TD|BT|RL|LR)$/i;
const SIMPLE_NODE = String.raw`[A-Za-z][A-Za-z0-9_-]*(?:\[[^\[\]\n<>{}()]+\]|\([^()\n<>{}\[\]]+\)|\{[^{}\n<>()\[\]]+\})?`;
const SIMPLE_ARROW = String.raw`(?:-->|-\.->|==>)`;
const SIMPLE_EDGE = new RegExp(
  String.raw`^${SIMPLE_NODE}\s*${SIMPLE_ARROW}\s*(?:\|[^|\n<>]+\|\s*)?${SIMPLE_NODE}(?:\s*${SIMPLE_ARROW}\s*(?:\|[^|\n<>]+\|\s*)?${SIMPLE_NODE})*$`,
);

/** Removes an optional outer Markdown fence and returns a safe flowchart subset. */
export function normalizeMermaid(value: string): string | null {
  let source = value.trim();
  const fenced = source.match(/^```(?:mermaid)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) source = fenced[1].trim();

  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2 || !FLOWCHART_HEADER.test(lines[0])) return null;
  return lines.slice(1).every((line) => SIMPLE_EDGE.test(line)) ? source : null;
}
