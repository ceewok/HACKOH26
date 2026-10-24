// The single backend seam. Every network call goes through here, coding against
// the contract in docs/specs/bridge-builder.md §4. If a shape is wrong or
// missing, raise it via the sync-coordinator — do not fake it elsewhere.

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

export interface ApiError {
  code: string;
  message: string;
}

export class ApiClientError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "content-type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiClientError(0, "network_error", "Could not reach the server.");
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const err = (data?.error ?? {}) as Partial<ApiError>;
    throw new ApiClientError(res.status, err.code ?? "error", err.message ?? res.statusText);
  }
  return data as T;
}

// --- Contract types (mirror the backend) ---

export type Role = "student" | "pro";

export interface HealthResponse {
  status: string;
  time: string;
}

export interface ProblemSummary {
  id: string;
  title: string;
  hook: string;
  isWeekly: boolean;
}

export interface Problem extends ProblemSummary {
  description: string;
  constraints: string[];
  hintPills: string[];
}

export interface DiagramSpec {
  api: string;
  processing: string;
  storage: string;
  bottlenecks: string;
}

export interface DiagramResponse {
  mermaid: string;
}

export interface Author {
  role: Role;
  nickname: string;
  company?: string;
}

export interface Solution {
  id: string;
  problemId: string;
  author: Author;
  spec: DiagramSpec;
  mermaid: string;
  parentSolutionId?: string;
  tweakNote?: string;
  endorsedByPro: boolean;
  createdAt: string;
}

export interface PublishSolutionInput {
  problemId: string;
  author: Author;
  spec: DiagramSpec;
  mermaid: string;
}

export interface PublishSolutionResponse {
  solution: Solution;
}

// --- Endpoints (filled in per task) ---

export const api = {
  health: () => request<HealthResponse>("/health"),
  listProblems: () => request<ProblemSummary[]>("/problems"),
  getProblem: (id: string) => request<Problem>(`/problems/${encodeURIComponent(id)}`),
  generateDiagram: (problemId: string, spec: DiagramSpec) =>
    request<DiagramResponse>("/ai/diagram", {
      method: "POST",
      body: JSON.stringify({ problemId, spec }),
    }),
  publishSolution: (input: PublishSolutionInput) =>
    request<PublishSolutionResponse>("/solutions", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
