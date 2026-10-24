// Route for Bedrock diagram generation. Contract: docs/specs/bridge-builder.md §4.
//   POST /ai/diagram  -> { mermaid }   (Task 5)
//
// Stubbed with a clear 501 until Task 5 wires Amazon Bedrock Converse.

import { HttpError } from "../http.js";
import { route } from "../router.js";

route("POST", "/ai/diagram", () => {
  throw new HttpError(501, "not_implemented", "POST /ai/diagram is not implemented yet");
});
