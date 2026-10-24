import { test } from "node:test";
import assert from "node:assert/strict";
import { createSolutionHandlers } from "./solutions.js";
import { HttpError, type ApiRequest } from "../http.js";
import type { Problem, Solution } from "../types.js";

const problem: Problem = {
  id: "peer-demo-feedback",
  title: "Peer Demo Feedback",
  hook: "Design a feedback pipeline.",
  description: "A complete problem.",
  constraints: ["Keep feedback short."],
  hintPills: ["DynamoDB"],
  isWeekly: false,
};

const validBody = {
  problemId: problem.id,
  author: { role: "student", nickname: "Alex", company: "ignored for students" },
  spec: { api: "API Gateway", processing: "Lambda", storage: "DynamoDB", bottlenecks: "Queue spikes" },
  mermaid: "flowchart TD\nClient --> Api",
};

function request(body: unknown): ApiRequest {
  return { method: "POST", params: {}, query: {}, body };
}

function handlers(options?: { knownProblem?: Problem | null; failRead?: boolean; failWrite?: boolean }) {
  const written: Solution[] = [];
  const implementation = createSolutionHandlers({
    getProblem: async () => {
      if (options?.failRead) throw new Error("DynamoDB details");
      return options?.knownProblem === undefined ? problem : options.knownProblem;
    },
    putSolution: async (solution) => {
      if (options?.failWrite) throw new Error("DynamoDB details");
      written.push(solution);
    },
  });
  return { implementation, written };
}

test("POST /solutions creates a server-owned public solution", async () => {
  const { implementation, written } = handlers();
  const result = await implementation.publish(request(validBody));

  assert.equal(result.status, 201);
  const solution = (result.body as { solution: Solution }).solution;
  assert.equal(written.length, 1);
  assert.equal(solution, written[0]);
  assert.match(solution.id, /^[0-9a-f-]{36}$/i);
  assert.ok(!Number.isNaN(Date.parse(solution.createdAt)));
  assert.equal(solution.endorsedByPro, false);
  assert.deepEqual(solution.author, { role: "student", nickname: "Alex" });
  assert.equal(solution.mermaid, validBody.mermaid);
});

test("POST /solutions accepts a pro author with company", async () => {
  const { implementation } = handlers();
  const result = await implementation.publish(
    request({ ...validBody, author: { role: "pro", nickname: "Morgan", company: "Honda" } }),
  );

  assert.equal(result.status, 201);
  assert.deepEqual((result.body as { solution: Solution }).solution.author, {
    role: "pro",
    nickname: "Morgan",
    company: "Honda",
  });
});

test("POST /solutions rejects malformed data and an entirely blank spec", async () => {
  const { implementation } = handlers();
  const invalidBodies = [
    undefined,
    {},
    { ...validBody, problemId: "" },
    { ...validBody, author: { role: "pro", nickname: "Alex" } },
    { ...validBody, spec: { api: "", processing: "", storage: "", bottlenecks: "" } },
    { ...validBody, mermaid: "" },
    { ...validBody, mermaid: "This is not Mermaid" },
  ];

  for (const body of invalidBodies) {
    await assert.rejects(
      () => implementation.publish(request(body)),
      (error: unknown) => error instanceof HttpError && error.status === 400 && error.code === "bad_request",
    );
  }
});

test("POST /solutions returns 404 without writing for an unknown problem", async () => {
  const { implementation, written } = handlers({ knownProblem: null });

  await assert.rejects(
    () => implementation.publish(request(validBody)),
    (error: unknown) => error instanceof HttpError && error.status === 404 && error.code === "not_found",
  );
  assert.equal(written.length, 0);
});

test("POST /solutions returns a generic 500 for repository failures", async () => {
  const readFailure = handlers({ failRead: true });
  const writeFailure = handlers({ failWrite: true });

  for (const implementation of [readFailure.implementation, writeFailure.implementation]) {
    await assert.rejects(
      () => implementation.publish(request(validBody)),
      (error: unknown) =>
        error instanceof HttpError &&
        error.status === 500 &&
        error.code === "internal_error" &&
        error.message === "Unable to publish solution. Try again shortly.",
    );
  }
});
