// Routes for problems. Contract: docs/specs/bridge-builder.md §4.
//   GET /problems            -> ProblemSummary[]
//   GET /problems/{id}       -> Problem

import type { ApiRequest, ApiResponse } from "../http.js";
import { errors, HttpError, ok } from "../http.js";
import { route } from "../router.js";
import { getProblem, listProblems } from "../repo.js";
import type { Problem, ProblemSummary } from "../types.js";

/** Narrow data dependency for testable problem handlers. */
export interface ProblemReader {
  listProblems(): Promise<ProblemSummary[]>;
  getProblem(id: string): Promise<Problem | null>;
}

function storageFailure(error: unknown): never {
  if (error instanceof HttpError) throw error;
  throw errors.internal("Unable to load problems. Try again shortly.");
}

/**
 * Make handlers against a reader. Production uses the DynamoDB repository;
 * tests supply a small in-memory reader without pretending DynamoDB passed.
 */
export function createProblemHandlers(reader: ProblemReader): {
  list: (request: ApiRequest) => Promise<ApiResponse>;
  get: (request: ApiRequest) => Promise<ApiResponse>;
} {
  return {
    list: async () => {
      try {
        return ok(await reader.listProblems());
      } catch (error) {
        return storageFailure(error);
      }
    },
    get: async (request) => {
      const id = request.params.id?.trim();
      if (!id) throw errors.badRequest("Problem id is required");

      let problem: Problem | null;
      try {
        problem = await reader.getProblem(id);
      } catch (error) {
        return storageFailure(error);
      }

      if (!problem) throw errors.notFound(`No problem with id ${id}`);
      return ok(problem);
    },
  };
}

const handlers = createProblemHandlers({ listProblems, getProblem });
route("GET", "/problems", handlers.list);
route("GET", "/problems/:id", handlers.get);
