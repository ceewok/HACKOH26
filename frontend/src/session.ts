// Client identity: a localStorage session object { role, nickname, company? }.
// No auth — this is a demo. The persisted shape still enforces the public
// identity invariant: Industry Pros must have a company.

import type { Role } from "./api";

export interface Session {
  role: Role;
  nickname: string;
  company?: string;
}

const KEY = "bridge-builder.session";

function normalizeSession(value: unknown): Session | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const nickname = typeof candidate.nickname === "string" ? candidate.nickname.trim() : "";
  const role = candidate.role;

  if (!nickname || (role !== "student" && role !== "pro")) return null;
  if (role === "pro") {
    const company = typeof candidate.company === "string" ? candidate.company.trim() : "";
    return company ? { role, nickname, company } : null;
  }

  return { role, nickname };
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeSession(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session): void {
  const normalized = normalizeSession(session);
  if (!normalized) {
    throw new Error("A session requires a nickname and, for an Industry Pro, a company.");
  }
  localStorage.setItem(KEY, JSON.stringify(normalized));
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}
