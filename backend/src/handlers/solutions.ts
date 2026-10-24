// Routes for solutions + feedback. Contract: docs/specs/bridge-builder.md §4.
//   POST /solutions                         (Task 6)
//   GET  /problems/{id}/solutions?role=...  (Task 7)
//   GET  /solutions/{id}                    (Task 7)
//   POST /solutions/{id}/feedback           (Task 8)

import { randomUUID } from "node:crypto";
import { errors, HttpError, created, type ApiRequest, type ApiResponse } from "../http.js";
import { normalizeMermaid } from "../mermaid.js";
import { getProblem, putSolution } from "../repo.js";
import { route } from "../router.js";
import type { Author, Problem, Solution, SolutionSpec } from "../types.js";

export interface SolutionPublisher {
  getProblem(id: string): Promise<Problem | null>;
  putSolution(solution: Solution): Promise<void>;
}

interface PublishRequest {
  problemId: string;
  author: Author;
  spec: SolutionSpec;
  mermaid: string;
  parentSolutionId?: string;
  tweakNote?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw errors.badRequest(`${field} is required.`);
  return value.trim();
}

function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) throw errors.badRequest(`${field} must be a non-empty string.`);
  return value.trim();
}

/** Validate publish input and construct only client-controlled persisted fields. */
export function parsePublishRequest(body: unknown): PublishRequest {
  if (!isRecord(body)) throw errors.badRequest("A JSON request body is required.");
  if (!isRecord(body.author)) throw errors.badRequest("author is required.");
  if (!isRecord(body.spec)) throw errors.badRequest("spec is required.");

  const role = body.author.role;
  if (role !== "student" && role !== "pro") throw errors.badRequest("author.role must be student or pro.");
  const nickname = requiredText(body.author.nickname, "author.nickname");
  const author: Author =
    role === "pro"
      ? { role, nickname, company: requiredText(body.author.company, "author.company") }
      : { role, nickname };

  const fields: Array<keyof SolutionSpec> = ["api", "processing", "storage", "bottlenecks"];
  const spec = {} as SolutionSpec;
  for (const field of fields) {
    const value = body.spec[field];
    if (typeof value !== "string") throw errors.badRequest(`spec.${field} must be a string.`);
    spec[field] = value;
  }
  if (!fields.some((field) => spec[field].trim())) {
    throw errors.badRequest("At least one spec section must contain text.");
  }

  const mermaid = normalizeMermaid(requiredText(body.mermaid, "mermaid"));
  if (!mermaid) throw errors.badRequest("mermaid must be valid flowchart source.");

  return {
    problemId: requiredText(body.problemId, "problemId"),
    author,
    spec,
    mermaid,
    parentSolutionId: optionalText(body.parentSolutionId, "parentSolutionId"),
    tweakNote: optionalText(body.tweakNote, "tweakNote"),
  };
}

function storageFailure(error: unknown): never {
  if (error instanceof HttpError) throw error;
  throw errors.internal("Unable to publish solution. Try again shortly.");
}

/** Injectable publish handler for tests; production uses the DynamoDB repository. */
export function createSolutionHandlers(publisher: SolutionPublisher): {
  publish: (request: ApiRequest) => Promise<ApiResponse>;
} {
  return {
    publish: async (request) => {
      const publishRequest = parsePublishRequest(request.body);

      let problem: Problem | null;
      try {
        problem = await publisher.getProblem(publishRequest.problemId);
      } catch (error) {
        return storageFailure(error);
      }
      if (!problem) throw errors.notFound(`No problem with id ${publishRequest.problemId}`);

      const solution: Solution = {
        id: randomUUID(),
        problemId: publishRequest.problemId,
        author: publishRequest.author,
        spec: publishRequest.spec,
        mermaid: publishRequest.mermaid,
        ...(publishRequest.parentSolutionId ? { parentSolutionId: publishRequest.parentSolutionId } : {}),
        ...(publishRequest.tweakNote ? { tweakNote: publishRequest.tweakNote } : {}),
        endorsedByPro: false,
        createdAt: new Date().toISOString(),
      };

      try {
        await publisher.putSolution(solution);
      } catch (error) {
        return storageFailure(error);
      }
      return created({ solution });
    },
  };
}

const handlers = createSolutionHandlers({ getProblem, putSolution });
route("POST", "/solutions", handlers.publish);

const notImplemented = (what: string) => () => {
  throw new HttpError(501, "not_implemented", `${what} is not implemented yet`);
};

route("GET", "/problems/:id/solutions", notImplemented("GET /problems/:id/solutions"));
route("GET", "/solutions/:id", notImplemented("GET /solutions/:id"));
route("POST", "/solutions/:id/feedback", notImplemented("POST /solutions/:id/feedback"));
