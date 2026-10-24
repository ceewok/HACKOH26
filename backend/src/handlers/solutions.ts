// Routes for solutions + feedback. Contract: docs/specs/bridge-builder.md §4.
//   POST /solutions                         (Task 6)
//   GET  /problems/{id}/solutions?role=...  (Task 7)
//   GET  /solutions/{id}                    (Task 7)
//   POST /solutions/{id}/feedback           (Task 8)

import { randomUUID } from "node:crypto";
import { errors, HttpError, created, ok, type ApiRequest, type ApiResponse } from "../http.js";
import { normalizeMermaid } from "../mermaid.js";
import {
  getProblem,
  getSolutionById,
  listFeedbackForSolution,
  listSolutionsForProblem,
  putSolution,
} from "../repo.js";
import { route } from "../router.js";
import type {
  Author,
  Feedback,
  Problem,
  Solution,
  SolutionDetail,
  SolutionSpec,
  SolutionWithTweakCount,
} from "../types.js";

export interface SolutionRepository {
  getProblem(id: string): Promise<Problem | null>;
  putSolution(solution: Solution): Promise<void>;
  listSolutionsForProblem(problemId: string): Promise<Solution[]>;
  getSolutionById(id: string): Promise<Solution | null>;
  listFeedbackForSolution(solutionId: string): Promise<Feedback[]>;
}

interface PublishRequest {
  problemId: string;
  author: Author;
  spec: SolutionSpec;
  mermaid: string;
  parentSolutionId?: string;
  tweakNote?: string;
}

type GalleryRole = "all" | "student" | "pro";

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

function publishFailure(error: unknown): never {
  if (error instanceof HttpError) throw error;
  throw errors.internal("Unable to publish solution. Try again shortly.");
}

function readFailure(error: unknown): never {
  if (error instanceof HttpError) throw error;
  throw errors.internal("Unable to load solutions. Try again shortly.");
}

function sortNewest<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function parseGalleryRole(value: string | undefined): GalleryRole {
  if (value === undefined || value === "all") return "all";
  if (value === "student" || value === "pro") return value;
  throw errors.badRequest("role must be all, student, or pro.");
}

/** Injectable handlers for tests; production uses the DynamoDB repository. */
export function createSolutionHandlers(repository: SolutionRepository): {
  publish: (request: ApiRequest) => Promise<ApiResponse>;
  list: (request: ApiRequest) => Promise<ApiResponse>;
  detail: (request: ApiRequest) => Promise<ApiResponse>;
} {
  return {
    publish: async (request) => {
      const publishRequest = parsePublishRequest(request.body);

      let problem: Problem | null;
      try {
        problem = await repository.getProblem(publishRequest.problemId);
      } catch (error) {
        return publishFailure(error);
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
        await repository.putSolution(solution);
      } catch (error) {
        return publishFailure(error);
      }
      return created({ solution });
    },

    list: async (request) => {
      const role = parseGalleryRole(request.query.role);
      const problemId = requiredText(request.params.id, "problemId");

      let solutions: Solution[];
      try {
        solutions = await repository.listSolutionsForProblem(problemId);
      } catch (error) {
        return readFailure(error);
      }

      const tweakCounts = new Map<string, number>();
      for (const solution of solutions) {
        if (solution.parentSolutionId) {
          tweakCounts.set(solution.parentSolutionId, (tweakCounts.get(solution.parentSolutionId) ?? 0) + 1);
        }
      }

      const gallery = solutions
        .filter((solution) => role === "all" || solution.author.role === role)
        .map<SolutionWithTweakCount>((solution) => ({
          ...solution,
          tweakCount: tweakCounts.get(solution.id) ?? 0,
        }));
      return ok(sortNewest(gallery));
    },

    detail: async (request) => {
      const solutionId = requiredText(request.params.id, "solutionId");

      let solution: Solution | null;
      try {
        solution = await repository.getSolutionById(solutionId);
      } catch (error) {
        return readFailure(error);
      }
      if (!solution) throw errors.notFound(`No solution with id ${solutionId}`);

      let feedback: Feedback[];
      let problemSolutions: Solution[];
      try {
        [feedback, problemSolutions] = await Promise.all([
          repository.listFeedbackForSolution(solution.id),
          repository.listSolutionsForProblem(solution.problemId),
        ]);
      } catch (error) {
        return readFailure(error);
      }

      const detail: SolutionDetail = {
        ...solution,
        feedback,
        tweaks: sortNewest(problemSolutions.filter((candidate) => candidate.parentSolutionId === solution.id)),
      };
      return ok(detail);
    },
  };
}

const handlers = createSolutionHandlers({
  getProblem,
  putSolution,
  listSolutionsForProblem,
  getSolutionById,
  listFeedbackForSolution,
});
route("POST", "/solutions", handlers.publish);
route("GET", "/problems/:id/solutions", handlers.list);
route("GET", "/solutions/:id", handlers.detail);

const notImplemented = (what: string) => () => {
  throw new HttpError(501, "not_implemented", `${what} is not implemented yet`);
};

route("POST", "/solutions/:id/feedback", notImplemented("POST /solutions/:id/feedback"));
