# Master Instructions

Top-level context and operating rules for all agents working on this project.
Every agent should read this file first, then its own role file in `agents/`.

> Status: **Pre-idea.** The project concept has not been decided yet. Once it is,
> fill in the "Project Overview" and "Tech Stack" sections below and create the
> first spec in `docs/specs/`.

---

## 1. Context

- **Event:** HackOhio (hackathon — optimize for a working, demoable product over perfection).
- **Team model:** Multi-agent development. Specialized agents own distinct areas and
  coordinate through the `sync-coordinator`.
- **Timeline:** Short. Prefer the smallest change that works. Ship, then refine.

## 2. Project Overview

_TODO once the idea is chosen._

- **What we're building:**
- **Who it's for:**
- **Core demo flow (the one thing that must work):**
- **Explicit non-goals:**

## 3. Tech Stack

_TODO once the idea is chosen. Lock this early so agents don't diverge._

- **Frontend:**
- **Backend:**
- **Database / storage:**
- **Hosting / deploy:**
- **Package manager:**

## 4. Agent Roster

| Agent | File | Owns |
|-------|------|------|
| Backend Architect | `agents/backend-architect.md` | APIs, data models, server logic, integrations |
| Frontend Disciplinarian | `agents/frontend-disciplinarian.md` | UI, components, state, styling, accessibility |
| Sync Coordinator | `agents/sync-coordinator.md` | Cross-agent alignment, contracts, merge order |
| DevOps Engineer | `agents/devops-engineer.md` | Repo setup, env, CI, build, deploy, demo infra |
| QA Reviewer | `agents/qa-reviewer.md` | Testing, review, bug triage, demo readiness |

## 5. Shared Working Agreements

1. **Single source of truth for contracts.** The API/data contract lives in the
   active spec under `docs/specs/`. Backend and frontend both code against it.
   Do not change a shared contract without updating the spec and telling the
   `sync-coordinator`.
2. **Small, frequent commits.** Conventional-ish messages: `feat:`, `fix:`,
   `chore:`, `docs:`. Keep commits scoped to one concern.
3. **Branch, don't push to main.** Feature branches; integrate via the
   `sync-coordinator`'s merge order.
4. **Stay in your lane, flag the rest.** If a change touches another agent's
   area, surface it rather than silently editing across boundaries.
5. **Keep the demo working.** `main` should always be in a demoable state.
   If you're about to break it, branch.
6. **Document decisions, lightly.** Record anything non-obvious in the relevant
   spec so other agents aren't guessing.

## 6. Definition of Done (hackathon edition)

- The core demo flow works end to end.
- No crashes on the happy path.
- Env/setup steps are written down so anyone can run it.
- The spec reflects what was actually built.

## 7. Conventions

- **File naming:** kebab-case for files, PascalCase for components/classes.
- **Secrets:** never commit. Use a `.env` (gitignored) and document required keys
  in the spec or a `.env.example`.
- **Comments:** explain *why*, not *what*. Keep them sparse and useful.
