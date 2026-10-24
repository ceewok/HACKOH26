import { test } from "node:test";
import assert from "node:assert/strict";
import "./register.js";
import { dispatch } from "./router.js";
import { HttpError } from "./http.js";

test("GET /health returns ok status", async () => {
  const res = await dispatch("GET", "/health", {}, undefined);
  assert.equal(res.status, 200);
  const body = res.body as { status: string; time: string };
  assert.equal(body.status, "ok");
  assert.ok(!Number.isNaN(Date.parse(body.time)), "time is an ISO timestamp");
});

test("unknown route throws 404", async () => {
  await assert.rejects(
    () => dispatch("GET", "/does-not-exist", {}, undefined),
    (err: unknown) => err instanceof HttpError && err.status === 404,
  );
});

test("not-yet-implemented route throws 501", async () => {
  await assert.rejects(
    () => dispatch("POST", "/ai/diagram", {}, { problemId: "x", spec: {} }),
    (err: unknown) => err instanceof HttpError && err.status === 501,
  );
});
