import { test } from "node:test";
import assert from "node:assert/strict";
import { createSolutionHandlers } from "./solutions.js";
import { HttpError, type ApiRequest } from "../http.js";
import type { Feedback, Problem, Solution } from "../types.js";

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

function solution(overrides: Partial<Solution> & Pick<Solution, "id">): Solution {
  return {
    id: overrides.id,
    problemId: overrides.problemId ?? problem.id,
    author: overrides.author ?? { role: "student", nickname: "Alex" },
    spec: overrides.spec ?? validBody.spec,
    mermaid: overrides.mermaid ?? validBody.mermaid,
    parentSolutionId: overrides.parentSolutionId,
    tweakNote: overrides.tweakNote,
    endorsedByPro: overrides.endorsedByPro ?? false,
    createdAt: overrides.createdAt ?? "2026-10-24T00:00:00.000Z",
  };
}

function request(body: unknown, params: Record<string, string> = {}, query: Record<string, string> = {}): ApiRequest {
  return { method: "POST", params, query, body };
}

function handlers(options?: {
  knownProblem?: Problem | null;
  solutions?: Solution[];
  detailSolution?: Solution | null;
  feedback?: Feedback[];
  failRead?: boolean;
  failWrite?: boolean;
}) {
  const written: Solution[] = [];
  const implementation = createSolutionHandlers({
    getProblem: async () => {
      if (options?.failRead) throw new Error("DynamoDB details");
      return options?.knownProblem === undefined ? problem : options.knownProblem;
    },
    putSolution: async (record) => {
      if (options?.failWrite) throw new Error("DynamoDB details");
      written.push(record);
    },
    listSolutionsForProblem: async () => {
      if (options?.failRead) throw new Error("DynamoDB details");
      return options?.solutions ?? [];
    },
    getSolutionById: async () => {
      if (options?.failRead) throw new Error("DynamoDB details");
      return options?.detailSolution ?? null;
    },
    listFeedbackForSolution: async () => {
      if (options?.failRead) throw new Error("DynamoDB details");
      return options?.feedback ?? [];
    },
  });
  return { implementation, written };
}

test("POST /solutions creates a server-owned public solution", async () => {
  const { implementation, written } = handlers();
  const result = await implementation.publish(request(validBody));

  assert.equal(result.status, 201);
  const created = (result.body as { solution: Solution }).solution;
  assert.equal(written.length, 1);
  assert.equal(created, written[0]);
  assert.match(created.id, /^[0-9a-f-]{36}$/i);
  assert.ok(!Number.isNaN(Date.parse(created.createdAt)));
  assert.equal(created.endorsedByPro, false);
  assert.deepEqual(created.author, { role: "student", nickname: "Alex" });
  assert.equal(created.mermaid, validBody.mermaid);
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

test("POST /solutions rejects malformed data, blank specs, and invalid Mermaid", async () => {
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

test("GET /problems/{id}/solutions filters by role, counts all direct tweaks, and sorts newest first", async () => {
  const proParent = solution({
    id: "pro-parent",
    author: { role: "pro", nickname: "Morgan", company: "Honda" },
    createdAt: "2026-10-22T00:00:00.000Z",
  });
  const studentTweak = solution({
    id: "student-tweak",
    parentSolutionId: proParent.id,
    createdAt: "2026-10-24T00:00:00.000Z",
  });
  const studentOriginal = solution({ id: "student-original", createdAt: "2026-10-23T00:00:00.000Z" });
  const { implementation } = handlers({ solutions: [proParent, studentTweak, studentOriginal] });

  const proResult = await implementation.list(request(undefined, { id: problem.id }, { role: "pro" }));
  assert.equal(proResult.status, 200);
  assert.deepEqual(proResult.body, [{ ...proParent, tweakCount: 1 }]);

  const allResult = await implementation.list(request(undefined, { id: problem.id }));
  assert.deepEqual(
    (allResult.body as Solution[]).map((item) => item.id),
    ["student-tweak", "student-original", "pro-parent"],
  );
});

test("GET /problems/{id}/solutions rejects invalid roles and normalizes repository failures", async () => {
  const { implementation } = handlers();
  await assert.rejects(
    () => implementation.list(request(undefined, { id: problem.id }, { role: "mentor" })),
    (error: unknown) => error instanceof HttpError && error.status === 400 && error.code === "bad_request",
  );
  await assert.rejects(
    () => handlers({ failRead: true }).implementation.list(request(undefined, { id: problem.id })),
    (error: unknown) =>
      error instanceof HttpError &&
      error.status === 500 &&
      error.message === "Unable to load solutions. Try again shortly.",
  );
});

test("GET /solutions/{id} returns detail with feedback and direct tweaks only", async () => {
  const parent = solution({ id: "parent", createdAt: "2026-10-20T00:00:00.000Z" });
  const directOld = solution({ id: "direct-old", parentSolutionId: parent.id, createdAt: "2026-10-21T00:00:00.000Z" });
  const directNew = solution({ id: "direct-new", parentSolutionId: parent.id, createdAt: "2026-10-23T00:00:00.000Z" });
  const unrelated = solution({ id: "unrelated", parentSolutionId: "someone-else" });
  const feedback: Feedback[] = [
    { id: "feedback-1", solutionId: parent.id, author: { role: "student", nickname: "Sam" }, text: "Nice queue.", createdAt: "2026-10-22T00:00:00.000Z" },
  ];
  const { implementation } = handlers({
    detailSolution: parent,
    solutions: [parent, directOld, directNew, unrelated],
    feedback,
  });

  const result = await implementation.detail(request(undefined, { id: parent.id }));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ...parent, feedback, tweaks: [directNew, directOld] });
});

test("GET /solutions/{id} returns 404 or generic 500 safely", async () => {
  await assert.rejects(
    () => handlers({ detailSolution: null }).implementation.detail(request(undefined, { id: "missing" })),
    (error: unknown) => error instanceof HttpError && error.status === 404 && error.code === "not_found",
  );
  await assert.rejects(
    () => handlers({ failRead: true }).implementation.detail(request(undefined, { id: "x" })),
    (error: unknown) =>
      error instanceof HttpError &&
      error.status === 500 &&
      error.message === "Unable to load solutions. Try again shortly.",
  );
});
