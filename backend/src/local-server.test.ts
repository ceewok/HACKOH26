import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createLocalApp } from "./local-server.js";

test("local Express server returns the structured 400 envelope for malformed JSON", async () => {
  const server = createLocalApp().listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/ai/diagram`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"problemId":',
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: { code: "bad_request", message: "Invalid JSON body" },
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
