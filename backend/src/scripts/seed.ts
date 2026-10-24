// Seeds problems (incl. the weekly challenge) from seed/problems.json into the
// configured DynamoDB table. Idempotent: re-running overwrites by id, so adding
// a new entry to the JSON and re-running `npm run seed` surfaces it.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { putProblem } from "../repo.js";
import type { Problem } from "../types.js";

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = resolve(here, "../../seed/problems.json");

function validate(p: unknown, i: number): Problem {
  if (typeof p !== "object" || p === null) throw new Error(`problems[${i}] is not an object`);
  const o = p as Record<string, unknown>;
  for (const f of ["id", "title", "hook", "description"]) {
    if (typeof o[f] !== "string" || !o[f]) throw new Error(`problems[${i}].${f} missing`);
  }
  if (!Array.isArray(o.constraints)) throw new Error(`problems[${i}].constraints must be an array`);
  if (!Array.isArray(o.hintPills)) throw new Error(`problems[${i}].hintPills must be an array`);
  return {
    id: String(o.id),
    title: String(o.title),
    hook: String(o.hook),
    description: String(o.description),
    constraints: (o.constraints as unknown[]).map(String),
    hintPills: (o.hintPills as unknown[]).map(String),
    isWeekly: Boolean(o.isWeekly),
  };
}

async function main() {
  const raw = await readFile(seedPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("seed/problems.json must be a JSON array");

  const problems = parsed.map(validate);
  const weekly = problems.filter((p) => p.isWeekly).length;
  if (weekly !== 1) {
    console.warn(`Warning: expected exactly 1 weekly challenge, found ${weekly}.`);
  }

  for (const p of problems) {
    await putProblem(p);
    console.log(`  seeded ${p.isWeekly ? "[weekly] " : ""}${p.id}`);
  }
  console.log(`Seeded ${problems.length} problem(s).`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
