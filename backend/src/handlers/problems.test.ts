import { test } from "node:test";
import assert from "node:assert/strict";
import { createProblemHandlers } from "./problems.js";
import { HttpError, type ApiRequest } from "../http.js";
import type { Problem, ProblemSummary } from "../types.js";

const problem: Problem = {
  id: "peer-demo-feedback",
  title: "Peer Demo Feedback in Under a Minute",
  hook: "A student posts a demo.",
  description: "A full problem description.",
  constraints: ["Feedback takes under 60 seconds."],
  hintPills: ["DynamoDB"],
  isWeekly: false,
};

function request(params: Record<string, string> = {}): ApiRequest {
  return { method: "GET", params, query: {}, body: undefined };
}

test("GET /problems returns the Hub summary contract", async () => {
  const summaries: ProblemSummary[] = [
    { id: problem.id, title: problem.title, hook: problem.hook, isWeekly: problem.isWeekly },
  ];
  const handlers = createProblemHandlers({
    listProblems: async () => summaries,
    getProblem: async () => problem,
  });

  const result = await handlers.list(request());
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, summaries);
  assert.deepEqual(Object.keys((result.body as ProblemSummary[])[0]).sort(), [
    "hook",
    "id",
    "isWeekly",
    "title",
  ]);
});

test("GET /problems/{id} returns the complete problem contract", async () => {
  let lookedUpId = "";
  const handlers = createProblemHandlers({
    listProblems: async () => [],
    getProblem: async (id) => {
      lookedUpId = id;
      return problem;
    },
  });

  const result = await handlers.get(request({ id: `  ${problem.id}  ` }));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, problem);
  assert.equal(lookedUpId, problem.id, "route input is trimmed before repository lookup");
});

test("GET /problems/{id} rejects a blank id and reports unknown ids as 404", async () => {
  const handlers = createProblemHandlers({
    listProblems: async () => [],
    getProblem: async () => null,
  });

  await assert.rejects(
    () => handlers.get(request({ id: "   " })),
    (err: unknown) => err instanceof HttpError && err.status === 400 && err.code === "bad_request",
  );
  await assert.rejects(
    () => handlers.get(request({ id: "does-not-exist" })),
    (err: unknown) => err instanceof HttpError && err.status === 404 && err.code === "not_found",
  );
});

test("GET /problems returns a generic 500 when storage is unavailable", async () => {
  const handlers = createProblemHandlers({
    listProblems: async () => {
      throw new Error("DynamoDB connection details should not reach a client");
    },
    getProblem: async () => null,
  });

  await assert.rejects(
    () => handlers.list(request()),
    (err: unknown) =>
      err instanceof HttpError &&
      err.status === 500 &&
      err.code === "internal_error" &&
      err.message === "Unable to load problems. Try again shortly.",
  );
});