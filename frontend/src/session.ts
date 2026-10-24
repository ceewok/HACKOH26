// Client identity: a localStorage session object { role, nickname, company? }.
// No auth — this is a demo. Task 3 builds the onboarding UI on top of this.

import type { Role } from "./api";

export interface Session {
  role: Role;
  nickname: string;
  company?: string;
}

const KEY = "bridge-builder.session";

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.nickname || (s.role !== "student" && s.role !== "pro")) return null;
    return s;
  } catch {
    return null;
  }
}

export function setSession(session: Session): void {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}
