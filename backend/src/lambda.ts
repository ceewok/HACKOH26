// AWS Lambda entrypoint for API Gateway HTTP API (payload format 2.0).
// Translates the event into the framework-agnostic router and back.

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import "./register.js";
import { dispatch } from "./router.js";
import { errorBody } from "./http.js";

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  const query = (event.queryStringParameters ?? {}) as Record<string, string>;

  let body: unknown;
  if (event.body) {
    try {
      body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body);
    } catch {
      return json(400, { error: { code: "bad_request", message: "Invalid JSON body" } });
    }
  }

  try {
    const result = await dispatch(method, path, query, body);
    return json(result.status, result.body);
  } catch (err) {
    const { status, body: errBody } = errorBody(err);
    if (status >= 500) console.error(`[${method} ${path}]`, err);
    return json(status, errBody);
  }
}

function json(status: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}
