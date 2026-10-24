# Master Instructions

Top-level context and operating rules for all agents working on this project.
Every agent should read this file first, then its own role file in `agents/`.

> Status: **Idea locked — building.** Concept, stack, and contract are decided.
> The living spec is `docs/specs/bridge-builder.md` (single source of truth for
> the API/data contract). Keep this file and the spec current as the build evolves.

---

## 1. Context

- **Event:** HackOhio (hackathon — optimize for a working, demoable product over perfection).
- **Challenge:** HackOHI/O 2026 "Bridge Builder Challenge" (Honda / 99P Labs). Design one
  complete flow of a community platform where students learn by doing real work with each
  other and industry. See `docs/honda_challenge.md`.
- **Team model:** Multi-agent development. Specialized agents own distinct areas and
  coordinate through the `sync-coordinator`.
- **Timeline:** Short. Prefer the smallest change that works. Ship, then refine.

## 2. Project Overview

**Bridge Builder: System Design Studio** — the "try something small / give back" rung of
the Bridge Builder ladder, turned into a working flow.

- **What we're building:** A web app where students architect solutions to real-world
  system-design problems, and industry pros contribute in minutes (quick feedback + design
  tweaks). Every solution, tweak, and piece of feedback is public and becomes an earned,
  visible record of growth. The hero feature is a split-screen **Studio**: structured
  guided-spec prompts on the left, a live Mermaid architecture diagram (generated via Amazon
  Bedrock) on the right.
- **Who it's for:** OSU students (learn, build, get feedback in limited time) and industry
  mentors (give an hour, not six weeks — "Respect Everyone's Time").
- **Core demo flow (the one thing that must work):**
  onboard (pick role + nickname) → Hub (weekly challenge + problem grid) → open a problem →
  Studio (fill guided spec → "Update Blueprint" renders a Bedrock-generated diagram) →
  publish solution → gallery (browse, filter pros/students) → leave feedback (a pro's
  feedback lights up an "Endorsed by a Pro" badge) → tweak someone's design (pre-filled
  Studio) → tweak appears on the original as a community tweak.
- **Explicit non-goals:** real auth/accounts; private/visibility controls (everything is
  public); numeric "AI grader"; drag-and-drop canvas; AI stress-test/"Chaos Monkey"
  (deferred — diagram generation is the hero); weekly-challenge rotation logic (it's just a
  seeded entry); mobile-native app; admin UI.

**Judging alignment (from `docs/honda_challenge.md`):** Problem Solving, Creativity,
Clarity, Completeness. Guardrails we honor: "Community, Not a Job Board" (no recruiting
framing), "Respect Everyone's Time" (tweaks/feedback cost minutes), "Make Growth Visible"
(record earned from others), "Solve the Empty Room" (rich seed data), "Think Big but Start
Small" (one complete flow). AI translates the user's own thinking into a diagram — it does
not generate polish or grade.

## 3. Tech Stack

Full AWS serverless. Locked early so agents don't diverge.

- **Frontend:** React + Vite (TypeScript), React Router, the `mermaid` library for diagram
  rendering. Single `api.ts` seam for all backend calls.
- **Backend:** AWS Lambda (Node.js / TypeScript) behind API Gateway (HTTP API).
- **Database / storage:** DynamoDB, single-table design.
- **AI:** Amazon Bedrock (Converse API, Claude model) for spec-to-Mermaid generation.
- **Hosting / deploy:** Frontend on S3 + CloudFront; backend via API Gateway + Lambda.
  Infra-as-code via AWS SAM. Local dev runs frontend (Vite) + backend (SAM local or a
  lightweight local Express shim) against DynamoDB Local.
- **Package manager:** npm (lockfile committed). Runtime: Node.js 22.x.

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
