// Framework-agnostic request/response plumbing shared by the Express server
// (local dev) and the Lambda handler (deployed). Keeps all business logic in
// one place regardless of how it's invoked.

export interface ApiRequest {
  method: string;
  /** Path params, e.g. { id: "..." }. */
  params: Record<string, string>;
  /** Query params, e.g. { role: "pro" }. */
  query: Record<string, string>;
  /** Parsed JSON body (undefined for GET). */
  body: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

/** Thrown by handlers to produce a structured error response. */
export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const errors = {
  badRequest: (msg: string) => new HttpError(400, "bad_request", msg),
  notFound: (msg: string) => new HttpError(404, "not_found", msg),
  upstream: (msg: string) => new HttpError(502, "upstream_error", msg),
  internal: (msg: string) => new HttpError(500, "internal_error", msg),
};

export function errorBody(err: unknown): { status: number; body: unknown } {
  if (err instanceof HttpError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message } } };
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  return { status: 500, body: { error: { code: "internal_error", message } } };
}

export function ok(body: unknown): ApiResponse {
  return { status: 200, body };
}

export function created(body: unknown): ApiResponse {
  return { status: 201, body };
}
