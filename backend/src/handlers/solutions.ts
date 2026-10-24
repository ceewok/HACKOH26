// Routes for solutions + feedback. Contract: docs/specs/bridge-builder.md §4.
//   POST /solutions                         (Task 6)
//   GET  /problems/{id}/solutions?role=...  (Task 7)
//   GET  /solutions/{id}                    (Task 7)
//   POST /solutions/{id}/feedback           (Task 8)
//
// Implemented incrementally per the task plan. Routes not yet built return a
// clear 501 so the frontend never silently codes against fake behavior.

import { HttpError } from "../http.js";
import { route } from "../router.js";

const notImplemented = (what: string) => () => {
  throw new HttpError(501, "not_implemented", `${what} is not implemented yet`);
};

route("POST", "/solutions", notImplemented("POST /solutions"));
route("GET", "/problems/:id/solutions", notImplemented("GET /problems/:id/solutions"));
route("GET", "/solutions/:id", notImplemented("GET /solutions/:id"));
route("POST", "/solutions/:id/feedback", notImplemented("POST /solutions/:id/feedback"));
