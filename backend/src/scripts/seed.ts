// Synchronizes the weekly challenge and persistent problems from seed/problems.json.
// It also upserts a small public solution set from seed/solutions.json so a
// fresh demo gallery has useful examples before visitors publish their own work.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { normalizeMermaid } from "../mermaid.js";
import { deleteProblem, listProblemIds, putProblem, putSolution } from "../repo.js";
import type { Author, Problem, Solution, SolutionSpec } from "../types.js";

const here = dirname(fileURLToPath(import.meta.url));
export const defaultSeedPath = resolve(here, "../../seed/problems.json");
export const defaultSolutionSeedPath = resolve(here, "../../seed/solutions.json");

type ProblemWriter = (problem: Problem) => Promise<void>;
type SolutionWriter = (solution: Solution) => Promise<void>;

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

function validateAuthor(value: unknown, path: string): Author {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  const author = value as Record<string, unknown>;
  const role = author.role;
  const nickname = requiredText(author.nickname, `${path}.nickname`);
  if (role === "student") return { role, nickname };
  if (role === "pro") return { role, nickname, company: requiredText(author.company, `${path}.company`) };
  throw new Error(`${path}.role must be student or pro`);
}

function validateSpec(value: unknown, path: string): SolutionSpec {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  const spec = value as Record<string, unknown>;
  const fields: Array<keyof SolutionSpec> = ["api", "processing", "storage", "bottlenecks"];
  const result = {} as SolutionSpec;
  for (const field of fields) result[field] = requiredText(spec[field], `${path}.${field}`);
  return result;
}

/** Validate one JSON problem entry and return its typed representation. */
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

export function validateSeedSolutions(value: unknown): Solution[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("seed/solutions.json must be a non-empty JSON array");
  }

  const ids = new Set<string>();
  return value.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`solutions[${index}] must be an object`);
    }
    const solution = entry as Record<string, unknown>;
    const id = requiredText(solution.id, `solutions[${index}].id`);
    if (ids.has(id)) throw new Error(`seed/solutions.json has duplicate id "${id}"`);
    ids.add(id);
    const mermaid = normalizeMermaid(requiredText(solution.mermaid, `solutions[${index}].mermaid`));
    if (!mermaid) throw new Error(`solutions[${index}].mermaid must be valid flowchart source`);
    const createdAt = requiredText(solution.createdAt, `solutions[${index}].createdAt`);
    if (Number.isNaN(Date.parse(createdAt))) throw new Error(`solutions[${index}].createdAt must be ISO-compatible`);
    if (typeof solution.endorsedByPro !== "boolean") throw new Error(`solutions[${index}].endorsedByPro must be a boolean`);

    return {
      id,
      problemId: requiredText(solution.problemId, `solutions[${index}].problemId`),
      author: validateAuthor(solution.author, `solutions[${index}].author`),
      spec: validateSpec(solution.spec, `solutions[${index}].spec`),
      mermaid,
      endorsedByPro: solution.endorsedByPro,
      createdAt,
    };
  });
}

/** Load and validate a problem catalog. */
export async function loadSeedProblems(path = defaultSeedPath): Promise<Problem[]> {
  const raw = await readFile(path, "utf8");
  return validateCatalog(JSON.parse(raw));
}

/** Load and validate public gallery examples. */
export async function loadSeedSolutions(path = defaultSolutionSeedPath): Promise<Solution[]> {
  const raw = await readFile(path, "utf8");
  return validateSeedSolutions(JSON.parse(raw));
}

/** Write every supplied problem with upsert semantics. */
export async function seedProblems(problems: Problem[], write: ProblemWriter = putProblem): Promise<number> {
  for (const problem of problems) await write(problem);
  return problems.length;
}

/** Write every supplied public demo solution with upsert semantics. */
export async function seedSolutions(solutions: Solution[], write: SolutionWriter = putSolution): Promise<number> {
  for (const solution of solutions) await write(solution);
  return solutions.length;
}

/** Reconcile the managed problem catalog after all desired entries write successfully. */
export async function syncSeedCatalog(problems: Problem[], store: ProblemCatalogStore): Promise<SeedResult> {
  const upserted = await seedProblems(problems, store.write);
  const desiredIds = new Set(problems.map((problem) => problem.id));
  const removed = (await store.listIds()).filter((id) => !desiredIds.has(id));

  for (const id of removed) await store.remove(id);
  return { upserted, removed };
}

export async function main(): Promise<void> {
  const problems = await loadSeedProblems();
  const result = await syncSeedCatalog(problems, { write: putProblem, listIds: listProblemIds, remove: deleteProblem });
  const solutions = await loadSeedSolutions();
  const seededSolutions = await seedSolutions(solutions);

  for (const problem of problems) console.log(`  seeded ${problem.isWeekly ? "[weekly] " : ""}${problem.id}`);
  for (const id of result.removed) console.log(`  retired ${id}`);
  for (const solution of solutions) console.log(`  seeded solution ${solution.id}`);
  console.log(`Seeded ${result.upserted} problem(s), ${seededSolutions} solution(s); retired ${result.removed.length} problem(s).`);
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
