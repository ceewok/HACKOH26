// Local dev server. Wraps the framework-agnostic router in Express so the whole
// API runs on http://localhost:PORT without AWS. Used by `npm run dev`.

import express from "express";
import cors from "cors";
import { config } from "./config.js";
import "./register.js";
import { dispatch } from "./router.js";
import { errorBody } from "./http.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.all(/.*/, async (req, res) => {
  try {
    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.query)) {
      query[k] = Array.isArray(v) ? String(v[0]) : String(v);
    }
    const result = await dispatch(req.method, req.path, query, req.body);
    res.status(result.status).json(result.body);
  } catch (err) {
    const { status, body } = errorBody(err);
    if (status >= 500) console.error(`[${req.method} ${req.path}]`, err);
    res.status(status).json(body);
  }
});

app.listen(config.port, () => {
  console.log(`Bridge Builder API (local) on http://localhost:${config.port}`);
  console.log(`  table=${config.tableName} dynamo=${config.dynamoEndpoint ?? "AWS"}`);
});
