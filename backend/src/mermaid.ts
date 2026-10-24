// Conservative Mermaid flowchart sanitizer shared by generation and publication.
// It accepts a small, safe flowchart subset. Rather than rejecting an entire
// diagram over one stray line, it strips a Markdown fence, drops prose/comment
// lines, and sanitizes label punctuation, then keeps the result only if a valid
// header plus at least one usable node/edge line remain.

const FLOWCHART_HEADER = /^(?:flowchart|graph)\s+(?:TB|TD|BT|RL|LR)$/i;
const NODE_ID = String.raw`[A-Za-z][A-Za-z0-9_-]*`;
const LABEL = String.raw`(?:\[[^\[\]\n<>{}()"';]+\]|\([^()\n<>{}\[\]"';]+\)|\{[^{}\n<>()\[\]"';]+\})`;
const SIMPLE_NODE = String.raw`${NODE_ID}(?:${LABEL})?`;
const SIMPLE_ARROW = String.raw`(?:-->|-\.->|==>)`;
const EDGE_LABEL = String.raw`(?:\|[^|\n<>]+\|)?`;
const EDGE_SEGMENT = String.raw`\s*${SIMPLE_ARROW}\s*${EDGE_LABEL}\s*${SIMPLE_NODE}`;
const SIMPLE_EDGE = new RegExp(String.raw`^${SIMPLE_NODE}(?:${EDGE_SEGMENT})+$`);
const SIMPLE_NODE_LINE = new RegExp(String.raw`^${SIMPLE_NODE}$`);

function stripFence(value: string): string {
  const fenced = value.trim().match(/^```(?:mermaid)?\s*([\s\S]*?)\s*```$/i);
  return (fenced ? fenced[1] : value).trim();
}

function isKeptLine(line: string): boolean {
  return SIMPLE_NODE_LINE.test(line) || SIMPLE_EDGE.test(line);
}

/**
 * Returns a safe flowchart subset, or null if no usable diagram remains.
 * The first non-empty line must be a valid flowchart header; subsequent lines
 * that are not valid node/edge statements are dropped rather than failing the
 * whole diagram. At least one real node/edge line must survive.
 */
export function normalizeMermaid(value: string): string | null {
  const lines = stripFence(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2 || !FLOWCHART_HEADER.test(lines[0])) return null;

  const body = lines.slice(1).filter(isKeptLine);
  if (body.length === 0) return null;

  return ["flowchart TD", ...body].join("\n");
}
