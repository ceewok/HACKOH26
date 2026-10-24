import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSeedProblems, loadSeedSolutions, seedProblems, seedSolutions, syncSeedCatalog, validateCatalog } from "./seed.js";
import type { Problem, Solution } from "../types.js";

test("the seed catalog has one weekly challenge and six persistent problems", async () => {
  const problems = await loadSeedProblems();

  assert.equal(problems.length, 7);
  assert.equal(problems.filter((problem) => problem.isWeekly).length, 1);
  assert.equal(problems.filter((problem) => !problem.isWeekly).length, 6);
  assert.equal(new Set(problems.map((problem) => problem.id)).size, problems.length);

  for (const problem of problems) {
    assert.ok(problem.title.length > 0);
    assert.ok(problem.hook.length > 0);
    assert.ok(problem.description.length > 0);
    assert.ok(problem.constraints.length > 0);
    assert.ok(problem.hintPills.length > 0);
  }
});

test("re-seeding upserts an added problem so it surfaces in the catalog", async () => {
  const existing = await loadSeedProblems();
  const table = new Map<string, Problem>();
  const write = async (problem: Problem) => {
    table.set(problem.id, problem);
  };

  await seedProblems(existing, write);
  assert.equal(table.size, existing.length);

  const added: Problem = {
    ...existing[1],
    id: "distributed-study-buddies",
    title: "Distributed Study Buddies",
    isWeekly: false,
  };
  await seedProblems([...existing, added], write);

  assert.equal(table.size, existing.length + 1);
  assert.equal(table.get(added.id)?.title, "Distributed Study Buddies");

  const revised = { ...added, title: "Distributed Study Buddies, Revised" };
  await seedProblems([revised], write);
  assert.equal(table.size, existing.length + 1, "re-seeding the same id is an upsert");
  assert.equal(table.get(added.id)?.title, "Distributed Study Buddies, Revised");
});

test("seed validation rejects duplicate ids and multiple weekly challenges", () => {
  const entry = {
    id: "valid-problem",
    title: "Valid Problem",
    hook: "A valid hook.",
    description: "A valid description.",
    constraints: ["One constraint."],
    hintPills: ["DynamoDB"],
    isWeekly: true,
  };

  assert.throws(() => validateCatalog([entry, { ...entry, id: "another-weekly" }]), {
    message: /exactly 1 weekly challenge/,
  });
  assert.throws(() => validateCatalog([entry, { ...entry, isWeekly: false }]), {
    message: /duplicate id/,
  });
});

test("replacing the weekly challenge retires the old seeded record", async () => {
  const initial = await loadSeedProblems();
  const table = new Map<string, Problem>();
  const store = {
    write: async (problem: Problem) => {
      table.set(problem.id, problem);
    },
    listIds: async () => [...table.keys()],
    remove: async (id: string) => {
      table.delete(id);
    },
  };

  await syncSeedCatalog(initial, store);
  const retiredWeekly = initial.find((problem) => problem.isWeekly);
  assert.ok(retiredWeekly, "the initial catalog has a weekly challenge");

  const replacement: Problem = {
    ...retiredWeekly,
    id: "weekly-project-kickoff",
    title: "Weekly Challenge: Project Kickoff",
  };
  const replacementCatalog = [
    replacement,
    ...initial.filter((problem) => problem.id !== retiredWeekly.id),
  ];

  const result = await syncSeedCatalog(replacementCatalog, store);

  assert.deepEqual(result.removed, [retiredWeekly.id]);
  assert.equal(table.has(retiredWeekly.id), false);
  assert.equal(table.size, initial.length);
  assert.equal([...table.values()].filter((problem) => problem.isWeekly).length, 1);
  assert.equal(table.get(replacement.id)?.title, replacement.title);
});

test("the seed gallery includes public student and industry blueprints", async () => {
  const solutions = await loadSeedSolutions();

  assert.equal(solutions.length, 3);
  assert.ok(solutions.some((solution) => solution.author.role === "student"));
  assert.ok(solutions.some((solution) => solution.author.role === "pro"));
  assert.equal(new Set(solutions.map((solution) => solution.id)).size, solutions.length);
  assert.ok(solutions.every((solution) => solution.mermaid.startsWith("flowchart TD")));
});

test("re-seeding gallery examples upserts fixed solution ids", async () => {
  const solutions = await loadSeedSolutions();
  const table = new Map<string, Solution>();

  await seedSolutions(solutions, async (solution) => {
    table.set(solution.id, solution);
  });
  const revised = { ...solutions[0], spec: { ...solutions[0].spec, api: "Revised API" } };
  await seedSolutions([revised], async (solution) => {
    table.set(solution.id, solution);
  });

  assert.equal(table.size, solutions.length);
  assert.equal(table.get(revised.id)?.spec.api, "Revised API");
});