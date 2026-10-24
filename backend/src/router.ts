// Framework-agnostic router. Maps (method, path) to a handler that takes an
// ApiRequest and returns an ApiResponse. The Express server and the Lambda
// entrypoint both drive this, so business logic lives in exactly one place.

import { type ApiRequest, type ApiResponse, errors } from "./http.js";

type Handler = (req: ApiRequest) => Promise<ApiResponse> | ApiResponse;

interface Route {
  method: string;
  /** Path template, e.g. "/problems/:id". */
  pattern: string;
  handler: Handler;
}

const routes: Route[] = [];

export function route(method: string, pattern: string, handler: Handler): void {
  routes.push({ method: method.toUpperCase(), pattern, handler });
}

/** Match a concrete path against a template, extracting :params. */
function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const u = path.split("/").filter(Boolean);
  if (p.length !== u.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) {
      params[p[i].slice(1)] = decodeURIComponent(u[i]);
    } else if (p[i] !== u[i]) {
      return null;
    }
  }
  return params;
}

export async function dispatch(
  method: string,
  path: string,
  query: Record<string, string>,
  body: unknown,
): Promise<ApiResponse> {
  for (const r of routes) {
    if (r.method !== method.toUpperCase()) continue;
    const params = match(r.pattern, path);
    if (params) {
      return r.handler({ method, params, query, body });
    }
  }
  throw errors.notFound(`No route for ${method} ${path}`);
}

// Routes are registered from ./register.ts (imported by each entrypoint) to
// avoid a circular init between this module and the handler modules.
