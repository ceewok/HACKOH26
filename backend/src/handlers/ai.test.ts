import { test } from "node:test";
import assert from "node:assert/strict";
import { createAiHandlers, createBedrockDiagramGenerator } from "./ai.js";
import { HttpError, type ApiRequest } from "../http.js";
import type { DiagramGenerator } from "./ai.js";

const validBody = {
  problemId: "weekly-live-office-hours",
  spec: {
    api: "API Gateway and WebSockets",
    processing: "Lambda consumes session events",
    storage: "DynamoDB stores queue state",
    bottlenecks: "Burst joins use a queue",
  },
};

function request(body: unknown): ApiRequest {
  return { method: "POST", params: {}, query: {}, body };
}

function handlerFor(output: string): ReturnType<typeof createAiHandlers> {
  const generator: DiagramGenerator = { generate: async () => output };
  return createAiHandlers(generator);
}

test("POST /ai/diagram returns normalized Mermaid flowchart source", async () => {
  const handlers = handlerFor("```mermaid\nflowchart TD\nClient --> Api\n```");

  const result = await handlers.generate(request(validBody));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { mermaid: "flowchart TD\nClient --> Api" });
});

test("POST /ai/diagram allows empty individual spec fields", async () => {
  const handlers = handlerFor("graph TD\nA --> B");
  const result = await handlers.generate(
    request({
      problemId: "empty-spec",
      spec: { api: "", processing: "", storage: "", bottlenecks: "" },
    }),
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { mermaid: "flowchart TD\nA --> B" });
});

test("POST /ai/diagram keeps usable lines and drops stray prose", async () => {
  const handlers = handlerFor(
    "flowchart TD\nHere is your diagram:\nA[Client] --> B[API]\nThanks for using the studio!\nB --> C[DynamoDB]",
  );
  const result = await handlers.generate(request(validBody));

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { mermaid: "flowchart TD\nA[Client] --> B[API]\nB --> C[DynamoDB]" });
});

test("POST /ai/diagram rejects malformed request bodies", async () => {
  const handlers = handlerFor("flowchart TD\nA --> B");
  for (const body of [undefined, {}, { problemId: "x" }, { problemId: "x", spec: { api: 1 } }]) {
    await assert.rejects(
      () => handlers.generate(request(body)),
      (error: unknown) => error instanceof HttpError && error.status === 400 && error.code === "bad_request",
    );
  }
});

test("POST /ai/diagram maps Bedrock failures and unusable output to generic 502 errors", async () => {
  const throwing: DiagramGenerator = {
    generate: async () => {
      throw new Error("AWS credentials should not leak");
    },
  };
  const broken = handlerFor("Here is your diagram: A goes to B");
  const declarationButInvalid = handlerFor("flowchart TD this is prose");
  const unbalancedLabel = handlerFor("flowchart TD\nA[[x] --> B");

  await assert.rejects(
    () => createAiHandlers(throwing).generate(request(validBody)),
    (error: unknown) =>
      error instanceof HttpError &&
      error.status === 502 &&
      error.message === "Unable to generate a diagram right now. Try again shortly.",
  );
  await assert.rejects(
    () => broken.generate(request(validBody)),
    (error: unknown) =>
      error instanceof HttpError &&
      error.status === 502 &&
      error.message === "Unable to generate a usable diagram. Try again shortly.",
  );
  await assert.rejects(
    () => declarationButInvalid.generate(request(validBody)),
    (error: unknown) =>
      error instanceof HttpError &&
      error.status === 502 &&
      error.message === "Unable to generate a usable diagram. Try again shortly.",
  );
  await assert.rejects(
    () => unbalancedLabel.generate(request(validBody)),
    (error: unknown) =>
      error instanceof HttpError &&
      error.status === 502 &&
      error.message === "Unable to generate a usable diagram. Try again shortly.",
  );
});

test("Bedrock Converse generator sends a constrained text request and extracts response text", async () => {
  let commandName = "";
  let maxTokens: number | undefined;
  let systemInstruction = "";
  const generator = createBedrockDiagramGenerator(async (command) => {
    commandName = command.constructor.name;
    maxTokens = command.input.inferenceConfig?.maxTokens;
    systemInstruction = command.input.system?.[0]?.text ?? "";
    return {
      output: { message: { content: [{ text: "flowchart TD\nStudent --> Studio" }] } },
    };
  });

  const result = await generator.generate(validBody);

  assert.equal(commandName, "ConverseCommand");
  assert.equal(maxTokens, 700);
  assert.match(systemInstruction, /Mermaid source only/);
  assert.equal(result, "flowchart TD\nStudent --> Studio");
});

test("POST /ai/diagram accepts safe standalone nodes and labelled edges", async () => {
  const handlers = handlerFor(
    "flowchart TD\nA[Problem ID weekly]\nB[API WebSocket gateway]\nA -->|connects to| B",
  );

  const result = await handlers.generate(request(validBody));
  assert.equal(result.status, 200);
  assert.match((result.body as { mermaid: string }).mermaid, /A -->\|connects to\| B$/);
});