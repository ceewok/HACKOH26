// Domain types — mirror the Contract in docs/specs/bridge-builder.md (§4).
// If these change, update the spec and the sync-coordinator status board.

export type Role = "student" | "pro";

export interface Author {
  role: Role;
  nickname: string;
  company?: string;
}

export interface Problem {
  id: string;
  title: string;
  hook: string;
  description: string;
  constraints: string[];
  hintPills: string[];
  isWeekly: boolean;
}

/** The list shape returned by GET /problems (lightweight for the Hub). */
export interface ProblemSummary {
  id: string;
  title: string;
  hook: string;
  isWeekly: boolean;
}

export interface SolutionSpec {
  api: string;
  processing: string;
  storage: string;
  bottlenecks: string;
}

export interface Solution {
  id: string;
  problemId: string;
  author: Author;
  spec: SolutionSpec;
  mermaid: string;
  parentSolutionId?: string;
  tweakNote?: string;
  endorsedByPro: boolean;
  createdAt: string;
}

/** Solution plus derived tweakCount, as returned by GET /problems/{id}/solutions. */
export interface SolutionWithTweakCount extends Solution {
  tweakCount: number;
}

export interface Feedback {
  id: string;
  solutionId: string;
  author: Author;
  text: string;
  createdAt: string;
}

/** Full detail shape for GET /solutions/{id}. */
export interface SolutionDetail extends Solution {
  feedback: Feedback[];
  tweaks: Solution[];
}
