// Central route registration. Imported once by each entrypoint (local server,
// Lambda, tests) BEFORE any dispatch. Kept separate from router.ts so the
// handler modules can import `route` from router.ts without a circular init.

import { ok } from "./http.js";
import { route } from "./router.js";

route("GET", "/health", () => ok({ status: "ok", time: new Date().toISOString() }));

// Feature routes (imported for the side effect of calling route()).
import "./handlers/problems.js";
import "./handlers/solutions.js";
import "./handlers/ai.js";
