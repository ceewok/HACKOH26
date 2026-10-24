// Synchronizes the weekly challenge and persistent problems from
// seed/problems.json. Adding or changing a problem is low-friction: edit one
// valid JSON entry and rerun `npm run seed`. The catalog owns all Problem
// records, so entries removed from the JSON are retired after new entries write.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { deleteProblem, listProblemIds, putProblem } from "../repo.js";
import type { Problem } from "../types.js";

const here = dirname(fileURLToPath(import.meta.url));
export const defaultSeedPath = resolve(here, "../../seed/problems.json");

type ProblemWriter = (problem: Problem) => Promise<void>;

export interface ProblemCatalogStore {
  write(problem: Problem): Promise<void>;
  listIds(): Promise<string[]>;
  remove(id: string): Promise<void>;
}

export interface SeedResult {
  upserted: number;
  removed: string[];
}

function requiredText(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value.trim();
}

function textList(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${path} must be a non-empty array`);
  }
  return value.map((item, index) => requiredText(item, `${path}[${index}]`));
}

/** Validate one JSON entry and return its typed Problem representation. */
export function validateProblem(value: unknown, index: number): Problem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`problems[${index}] must be an object`);
  }

  const entry = value as Record<string, unknown>;
  const id = requiredText(entry.id, `problems[${index}].id`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`problems[${index}].id must use lowercase kebab-case`);
  }
  if (typeof entry.isWeekly !== "boolean") {
    throw new Error(`problems[${index}].isWeekly must be a boolean`);
  }

  return {
    id,
    title: requiredText(entry.title, `problems[${index}].title`),
    hook: requiredText(entry.hook, `problems[${index}].hook`),
    description: requiredText(entry.description, `problems[${index}].description`),
    constraints: textList(entry.constraints, `problems[${index}].constraints`),
    hintPills: textList(entry.hintPills, `problems[${index}].hintPills`),
    isWeekly: entry.isWeekly,
  };
}

/** Validate whole-catalog invariants that make the Hub predictable. */
export function validateCatalog(value: unknown): Problem[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("seed/problems.json must be a non-empty JSON array");
  }

  const problems = value.map(validateProblem);
  const ids = new Set<string>();
  for (const problem of problems) {
    if (ids.has(problem.id)) {
      throw new Error(`seed/problems.json has duplicate id "${problem.id}"`);
    }
    ids.add(problem.id);
  }

  const weeklyCount = problems.filter((problem) => problem.isWeekly).length;
  if (weeklyCount !== 1) {
    throw new Error(`seed/problems.json must contain exactly 1 weekly challenge; found ${weeklyCount}`);
  }

  return problems;
}

/** Load and validate a catalog. Exported so the exact seed data is testable. */
export async function loadSeedProblems(path = defaultSeedPath): Promise<Problem[]> {
  const raw = await readFile(path, "utf8");
  return validateCatalog(JSON.parse(raw));
}

/** Write every supplied entry with upsert semantics. */
export async function seedProblems(
  problems: Problem[],
  write: ProblemWriter = putProblem,
): Promise<number> {
  for (const problem of problems) {
    await write(problem);
  }
  return problems.length;
}

/**
 * Reconcile the managed problem catalog after all desired entries write
 * successfully. This prevents stale weekly challenges from surviving when an
 * editor replaces their id in the JSON source.
 */
export async function syncSeedCatalog(
  problems: Problem[],
  store: ProblemCatalogStore,
): Promise<SeedResult> {
  const upserted = await seedProblems(problems, store.write);
  const desiredIds = new Set(problems.map((problem) => problem.id));
  const removed = (await store.listIds()).filter((id) => !desiredIds.has(id));

  for (const id of removed) {
    await store.remove(id);
  }

  return { upserted, removed };
}

export async function main(): Promise<void> {
  const problems = await loadSeedProblems();
  const result = await syncSeedCatalog(problems, {
    write: putProblem,
    listIds: listProblemIds,
    remove: deleteProblem,
  });

  for (const problem of problems) {
    console.log(`  seeded ${problem.isWeekly ? "[weekly] " : ""}${problem.id}`);
  }
  for (const id of result.removed) {
    console.log(`  retired ${id}`);
  }
  console.log(`Seeded ${result.upserted} problem(s); retired ${result.removed.length}.`);
}

function isMainModule(): boolean {
  const invokedPath = process.argv[1];
  return Boolean(invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url));
}

if (isMainModule()) {
  main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
