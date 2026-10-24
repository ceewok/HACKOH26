# Spec: Bridge Builder — System Design Studio

> Single source of truth for this feature. Backend implements the Contract (§4);
> frontend consumes it. Any change to the Contract must update this file AND the
> sync-coordinator status board (§7). Start new work from the orchestration rules
> in `../../master.md`.

- **Status:** in progress
- **Owner(s):** multi-agent (backend-architect, frontend-disciplinarian, sync-coordinator, devops-engineer, qa-reviewer)
- **Last updated:** 2026-10-24

---

## 1. Problem & Goal

HackOHI/O 2026 "Bridge Builder Challenge": build one complete flow of a community platform
where students learn by doing real work with each other and industry. We build the rung
where students architect solutions to real-world system-design problems, industry pros
contribute in minutes (quick feedback + tweaks), and the resulting solutions, tweaks, and
feedback become a public, earned record of growth.

**Success:** the core demo flow (below) runs start-to-finish with no crashes on the happy
path, on seeded data rich enough to never show an empty room.

**Core demo flow:** onboard → Hub → open problem → Studio (guided spec → Bedrock diagram) →
publish → gallery (filter pros/students) → feedback (pro endorsement badge) → tweak → tweak
shown on the original.

## 2. Requirements

- As a visitor, I can pick a role (Student or Industry Pro) and enter a nickname (plus
  company if Pro) with no sign-up; identity is kept in localStorage and sent with requests.
- As a user, I land on a Hub showing a Weekly Challenge hero card and a grid of persistent
  problem cards (title + short hook).
- As a user, I can open a problem to see its full description, constraints, and clickable
  Hint Pills (relevant building blocks/APIs).
- As a user, I can design a solution in a split-screen Studio: structured guided-spec
  prompts on the left; a live Mermaid architecture diagram on the right, generated on demand
  via Amazon Bedrock when I click "Update Blueprint."
- As a user, I can publish my solution so it's publicly visible with my author info.
- As a user, I can browse all solutions for a problem, filterable by All / Industry Pros /
  Students, with authors shown publicly.
- As a user, I can leave public feedback on a solution; when an Industry Pro leaves feedback,
  the solution shows an "Endorsed by a Pro" badge.
- As a user, I can "Tweak This Design" — the Studio opens pre-filled with the original
  author's spec + diagram; I edit it, add a one-line "why I tweaked this" note, and submit;
  the tweak is publicly linked to the parent solution.

**Non-goals:** real auth/accounts; private/visibility controls (all public); numeric "AI
grader"; drag-and-drop canvas; AI stress-test/"Chaos Monkey" (deferred); weekly-challenge
rotation; mobile-native app; admin UI.

## 3. Design

Four views, one DynamoDB single table, a small set of Lambda-backed endpoints, Bedrock for
diagram generation.

```
+-------------------+        +------------------------+        +-------------------+
|  React SPA        |  HTTP  |  API Gateway + Lambda  |        |  Amazon Bedrock   |
|  (S3 + CloudFront)| -----> |  (handlers)            | -----> |  (Converse/Claude)|
|  mermaid render   | <----- |                        | <----- |  -> Mermaid string|
+-------------------+        +-----------+------------+        +-------------------+
                                         |
                                         v
                              +----------------------+
                              |  DynamoDB (single    |
                              |  table: problems,    |
                              |  solutions, feedback)|
                              +----------------------+
```

- **Data flow:** React calls the API via a single `api.ts` seam. Lambdas read/write one
  DynamoDB table and call Bedrock for diagram generation. Identity is a localStorage object
  `{ role, nickname, company? }` sent in request bodies (no auth).
- **Views:** (1) Onboarding modal, (2) Hub dashboard, (3) Problem + Blueprint Studio,
  (4) Solution gallery + detail/tweak.
- **Key decisions:** see §6 and `../../master.md` §2–3. Diagram generation is on-demand
  (button), not live. Everything is public. AI translates the user's spec into Mermaid; it
  does not grade.
- **Open questions:** AWS account/region + Bedrock model access confirmation for deploy
  (tracked as a blocker in §7 until verified).

## 4. Contract (single source of truth)

> Backend implements this; frontend consumes it. Changes here must be announced to the
> `sync-coordinator` and reflected in §7.

### Conventions

- All request/response bodies are JSON. Timestamps are ISO-8601 strings (UTC).
- IDs are server-generated unless noted. `author` is `{ role, nickname, company? }` where
  `role` is `"student" | "pro"` and `company` is present only for pros.
- No auth header. Identity travels in the request body for writes.
- Errors: `{ "error": { "code": string, "message": string } }` with appropriate HTTP status.

### Data models (single-table DynamoDB)

```
Problem
  PK = PROBLEM#<id>   SK = META
  { id: string, title: string, hook: string, description: string,
    constraints: string[], hintPills: string[], isWeekly: boolean }

Solution
  PK = PROBLEM#<id>   SK = SOL#<id>
  { id: string, problemId: string,
    author: { role: "student"|"pro", nickname: string, company?: string },
    spec: { api: string, processing: string, storage: string, bottlenecks: string },
    mermaid: string,
    parentSolutionId?: string, tweakNote?: string,
    endorsedByPro: boolean, createdAt: string }

Feedback
  PK = SOL#<id>       SK = FB#<id>
  { id: string, solutionId: string,
    author: { role: "student"|"pro", nickname: string, company?: string },
    text: string, createdAt: string }
```

### Endpoints

```
GET /health
RESPONSE: 200 { "status": "ok", "time": "<iso>" }
ERRORS:   none expected
AUTH:     none
```

```
GET /problems
RESPONSE: 200 [ { id, title, hook, isWeekly } ]   // list for the Hub (weekly first)
ERRORS:   500 on storage failure
AUTH:     none
```

```
GET /problems/{id}
RESPONSE: 200 { id, title, hook, description, constraints[], hintPills[], isWeekly }
ERRORS:   404 if no such problem; 500 on storage failure
AUTH:     none
```

```
POST /ai/diagram
REQUEST:  { problemId: string,
            spec: { api, processing, storage, bottlenecks } }   // any field may be ""
RESPONSE: 200 { mermaid: string }   // a valid Mermaid flowchart string
ERRORS:   400 if spec missing; 502 if Bedrock fails or returns unusable output
AUTH:     none
NOTES:    On-demand ("Update Blueprint"). Lambda calls Bedrock Converse (Claude) with a
          system prompt constraining output to Mermaid only. Frontend keeps last good
          diagram on error.
```

```
POST /solutions
REQUEST:  { problemId, author, spec:{api,processing,storage,bottlenecks}, mermaid,
            parentSolutionId?, tweakNote? }
RESPONSE: 201 { solution }   // full Solution object incl. generated id + createdAt
ERRORS:   400 if required fields missing / spec empty; 404 if problemId unknown;
          500 on storage failure
AUTH:     none (author in body)
NOTES:    endorsedByPro defaults false. A tweak sets parentSolutionId + tweakNote.
```

```
GET /problems/{id}/solutions?role=all|pro|student
RESPONSE: 200 [ { ...solution, tweakCount: number } ]   // authors public; filtered by role
ERRORS:   400 on bad role value; 500 on storage failure
AUTH:     none
NOTES:    role defaults to "all". tweakCount = number of solutions whose parentSolutionId
          equals this solution's id.
```

```
GET /solutions/{id}
RESPONSE: 200 { ...solution, feedback: Feedback[], tweaks: Solution[] }
ERRORS:   404 if no such solution; 500 on storage failure
AUTH:     none
NOTES:    tweaks = child solutions (parentSolutionId == id).
```

```
POST /solutions/{id}/feedback
REQUEST:  { author, text }
RESPONSE: 201 { feedback, endorsedByPro }   // endorsedByPro reflects solution after write
ERRORS:   400 if text empty; 404 if solution unknown; 500 on storage failure
AUTH:     none (author in body)
NOTES:    If author.role == "pro", set the solution's endorsedByPro = true.
```

## 5. Tasks

- [x] (devops) Repo scaffold: frontend (Vite+React+TS), backend (SAM: API GW + Lambda +
      DynamoDB), `.gitignore`, `.env.example`, one-command local start in README. **(Task 1)**
- [x] (backend) `GET /health` live locally. **(Task 1)**
- [x] (backend) Task 2: seed catalog (one weekly + six persistent problems), idempotent
      `npm run seed`, `GET /problems`, and `GET /problems/{id}`. Contract/unit tests pass;
      real DynamoDB Local seed/API smoke remains blocked until Docker Desktop starts.
- [x] (frontend) Onboarding modal + Hub dashboard consuming `GET /problems`. Stores a local
      Student/Industry Pro demo identity and routes problem cards to the Task 4 destination.
      **(Task 3: frontend tests pass; real local-data smoke pending)**
- [x] (frontend) Problem page + Studio skeleton with Hint Pills. Consumes `GET /problems/{id}`
      and leaves a truthful Task 5 diagram-generation placeholder. **(Task 4: frontend tests
      pass; real local-data smoke pending)**
- [ ] (backend+frontend) `POST /ai/diagram` (Bedrock) + Studio render.
- [ ] (backend+frontend) `POST /solutions` + publish action.
- [ ] (backend+frontend) gallery + detail (`GET /problems/{id}/solutions`, `GET /solutions/{id}`).
- [ ] (backend+frontend) feedback + "Endorsed by a Pro" badge.
- [ ] (frontend+backend) tweak / fork flow.
- [ ] (qa+devops) end-to-end polish + demo hardening.

## 6. Notes / Decisions log

- _2026-10-24_ — Challenge is Bridge Builder; framed the AI as a diagram co-pilot (not a
  grader) to honor "Make Growth Visible" / no-polish guidance.
- _2026-10-24_ — Stack locked: AWS serverless (React/S3/CloudFront, API GW + Lambda,
  DynamoDB, Bedrock). Package manager npm, Node 22.x.
- _2026-10-24_ — Diagram generation is on-demand via "Update Blueprint" (not live/debounced)
  to keep the demo predictable and Bedrock calls bounded.
- _2026-10-24_ — Everything is public (authors, tweaks, feedback). "Endorsed by a Pro" badge
  when an Industry Pro leaves feedback.
- _2026-10-24_ — Problems + weekly challenge seeded from `seed/problems.json` into DynamoDB;
  adding a problem = a new JSON entry + re-seed. Weekly challenge is a seeded entry with
  `isWeekly: true`.
- _2026-10-24_ — Backend uses a framework-agnostic router shared by the local Express server
  and the Lambda handler, so business logic lives in one place. Routes register via
  `register.ts` (imported by each entrypoint) to avoid a circular-init issue surfaced by the
  router test.
- _2026-10-24_ (Task 1 done) — Local dev loads `.env` via Node `--env-file-if-exists` so a
  fresh clone runs before an `.env` exists. `GET /problems` verified to fail gracefully
  (500) without DynamoDB rather than crash the server.
- _2026-10-24_ (Task 2 implemented) — Seed catalog includes one weekly challenge plus six
  persistent problems. The seed script requires one weekly entry, unique lowercase kebab-case
  ids, and non-empty fields; the JSON source is authoritative, so after successful upserts it
  retires seeded problem records omitted from the file. This prevents a replaced weekly id
  from leaving two weekly cards. Added dummy SDK credentials only when `DYNAMODB_ENDPOINT` is
  set, which lets DynamoDB Local run without real AWS credentials. Docker Desktop was not
  running during validation, so a real local table/seed/API smoke test is tracked in the
  coordinator blocker board.
- _2026-10-24_ (Task 3 implemented) — Demo identity stays local: Student/Industry Pro,
  nickname, and pro company (required only for pros) persist in localStorage with no auth.
  Persisted values are normalized and invalid Pro records without a nonblank company return to
  onboarding rather than bypass the form. The Hub consumes only the published `GET /problems`
  summary shape, selects its weekly hero by `isWeekly`, and gives loading, empty, and retryable
  error states equal treatment. Problem cards route to a deliberate Task 4 placeholder rather
  than a broken URL.
- _2026-10-24_ (Task 4 implemented) — The detail page consumes only the published
  `GET /problems/{id}` shape. Hint Pill text appends to the focused guided-spec field, preserving
  creative control and providing an immediate nudge without a new API contract. The preview pane
  does not simulate a diagram or offer a no-op AI action; Task 5 owns the on-demand Bedrock +
  Mermaid integration.
