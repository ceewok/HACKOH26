// Local dev server. Wraps the framework-agnostic router in Express so the whole
// API runs on http://localhost:PORT without AWS. Used by `npm run dev`.

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { config } from "./config.js";
import "./register.js";
import { errorBody, errors } from "./http.js";
import { dispatch } from "./router.js";

/** Exported for transport-level tests of the local API contract. */
export function createLocalApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // Keep malformed JSON consistent with Lambda's explicit JSON.parse error response.
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof SyntaxError && "body" in error) {
      const { status, body } = errorBody(errors.badRequest("Invalid JSON body"));
      res.status(status).json(body);
      return;
    }
    next(error);
  });

  app.all(/.*/, async (req, res) => {
    try {
      const query: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.query)) {
        query[key] = Array.isArray(value) ? String(value[0]) : String(value);
      }
      const result = await dispatch(req.method, req.path, query, req.body);
      res.status(result.status).json(result.body);
    } catch (error) {
      const { status, body } = errorBody(error);
      if (status >= 500) console.error(`[${req.method} ${req.path}]`, error);
      res.status(status).json(body);
    }
  });

  return app;
}

function isMainModule(): boolean {
  const invokedPath = process.argv[1];
  return Boolean(invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url));
}

if (isMainModule()) {
  createLocalApp().listen(config.port, () => {
    console.log(`Bridge Builder API (local) on http://localhost:${config.port}`);
    console.log(`  table=${config.tableName} dynamo=${config.dynamoEndpoint ?? "AWS"}`);
  });
}
