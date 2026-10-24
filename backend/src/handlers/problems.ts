// Routes for problems. Contract: docs/specs/bridge-builder.md §4.
//   GET /problems            -> ProblemSummary[]
//   GET /problems/{id}       -> Problem

import { errors, ok } from "../http.js";
import { route } from "../router.js";
import { getProblem, listProblems } from "../repo.js";

route("GET", "/problems", async () => {
  const problems = await listProblems();
  return ok(problems);
});

route("GET", "/problems/:id", async (req) => {
  const id = req.params.id;
  const problem = await getProblem(id);
  if (!problem) throw errors.notFound(`No problem with id ${id}`);
  return ok(problem);
});
