# Sync Coordinator

> Read `../master.md` first. This file defines your role and boundaries.

## Mission

Keep the agents aligned. You own the seams *between* roles: shared contracts,
integration order, merge sequencing, and surfacing blockers before they stall
the team. You write little product code — your output is alignment.

## Owns

- The active spec's contract section (keeping it the single source of truth)
- Integration/merge order across branches
- Tracking blockers and dependencies between agents
- Resolving contract disputes (frontend expects X, backend returns Y)
- The running status of "what works end to end right now"

## Does NOT own

- Implementation inside any single domain (that's the specialist agents).

## Operating Principles

1. **Contract is law.** When frontend and backend disagree, the spec wins. If the
   spec is wrong, fix the spec first, then both sides align to it.
2. **Integrate in dependency order.** Merge the thing others depend on first
   (usually: data model → API → frontend consumption).
3. **Make blockers visible.** Maintain the status board below. A blocker that
   isn't written down doesn't get resolved.
4. **Protect the demo path.** The core flow in `master.md` section 2 is sacred.
   Prioritize anything that keeps it working; defer anything that risks it.
5. **Small merges, often.** Don't let branches drift far from `main`.

## Status Board (keep this current)

> Spec / contract source of truth: `../docs/specs/bridge-builder.md`.

### What works end-to-end right now
- **Task 1 (DONE):** repo skeleton + spec/contract + `GET /health`. Backend boots locally
  (`npm run start`), `/health` returns `{status:"ok",time}`, unknown routes 404, not-yet-
  built routes 501, and `/problems` fails gracefully (500) without DynamoDB rather than
  crashing. Frontend builds and its `HealthBadge` calls `/health` via the `/api` proxy and
  shows "Connected." Backend tests (3) + typechecks (backend + frontend) pass; Lambda bundle
  builds via esbuild. One-command local start documented in README.
- **Task 2 (IMPLEMENTED; local-Dynamo smoke pending):** the catalog now contains one weekly
  challenge and six persistent problems. The seed CLI enforces one weekly entry, unique
  kebab-case ids, and non-empty problem fields; it upserts source entries and retires entries
  removed from the authoritative JSON file. `GET /problems` and `GET /problems/{id}` match the contract in unit tests, including 400/404 handling and a safe
  generic 500 storage error. Eleven backend tests, typecheck, and Lambda build pass. QA review
  is approved. Docker Desktop's engine is not running, so a real DynamoDB Local table/seed/API
  run is pending.
- **Task 3 (IMPLEMENTED; local-data smoke pending):** the SPA opens with an accessible
  Student/Industry Pro onboarding dialog, stores nickname and required pro company in
  localStorage, then renders the Hub from `GET /problems`. The Hub selects the weekly problem
  by `isWeekly`, renders persistent cards, handles loading/empty/error/retry states, and routes
  cards to the Task 4 problem destination. Seven frontend browser tests cover onboarding,
  persistence, data states, retry, and navigation. QA review is approved. Real populated-Hub
  smoke remains coupled to the Docker-blocked Task 2 local data path.
- **Task 4 (IMPLEMENTED; local-data smoke pending):** `/problems/:id` now fetches the complete
  brief through `GET /problems/{id}`, renders description, constraints, and an accessible
  guided Studio. Hint Pills append to the active spec field. The diagram pane accurately says
  Bedrock/Mermaid generation arrives in Task 5; it makes no AI request. Four detail-page tests
  cover success, loading, retry, empty arrays, and pill insertion. QA review is approved.

### Active contracts
| Contract | Owner | Consumer | Status | Spec ref |
|----------|-------|----------|--------|----------|
| `GET /health` | backend-architect | frontend, qa | DONE (live locally) | spec §4 |
| `GET /problems`, `GET /problems/{id}` | backend-architect | frontend | Hub + detail page consume contracts; local-Dynamo smoke pending | spec §4 |
| `POST /ai/diagram` | backend-architect | frontend | defined (Task 5) | spec §4 |
| `POST /solutions` | backend-architect | frontend | defined (Task 6) | spec §4 |
| `GET /problems/{id}/solutions`, `GET /solutions/{id}` | backend-architect | frontend | defined (Task 7) | spec §4 |
| `POST /solutions/{id}/feedback` | backend-architect | frontend | defined (Task 8) | spec §4 |

### Blockers
| Blocker | Who's blocked | Needs | Owner | Status |
|---------|---------------|-------|-------|--------|
| Docker Desktop engine not running | backend, qa (real DynamoDB Local seed/API smoke) | start Docker Desktop, then run `npm run db:setup`, `npm run seed`, and the local API smoke | user / devops | open — code/unit validation completed |
| AWS account + region + Bedrock model access | devops, backend (deploy + `POST /ai/diagram`) | user to confirm AWS creds, region, and that a Claude model is enabled in Bedrock | user / devops | open — local dev proceeds without it |

### Merge queue
1. ~~`feat/task-1-skeleton` — repo scaffold + spec + health check~~ → merged to `main` (d89694f)
2. ~~`feat/task-2-problems-api` — enriched seed catalog + hardened problem endpoints + tests~~ → merged to `main` (0fc4e45); local-Dynamo smoke remains blocked
3. ~~`feat/task-3-onboarding-hub` — role onboarding + persisted demo identity + Hub dashboard~~ → merged to `main` (c852b5d); local-data smoke remains blocked
4. `feat/task-4-problem-studio` — full problem brief + guided Studio + Hint Pills (QA approved; local-data smoke blocked)
5. (next) Task 5 — Bedrock diagram generation + Mermaid render

> **Repo note (devops):** This workspace lives under OneDrive, which locks folders during
> Git's working-tree swaps and can hang an interactive branch `checkout`. Integrate by
> committing on a branch and fast-forwarding `main` (`git branch -f main <branch>`) rather
> than `git checkout main && git merge`. Keeps main demoable without the lock risk.

## Role dispatch map (who owns each task)

| Task | Lead | Support |
|------|------|---------|
| 1. Repo + skeleton + spec | devops-engineer | backend-architect, sync-coordinator |
| 2. Seed + problems API | backend-architect | sync-coordinator |
| 3. Onboarding + Hub | frontend-disciplinarian | — |
| 4. Problem page + Studio skeleton | frontend-disciplinarian | — |
| 5. Bedrock diagram | backend-architect | frontend-disciplinarian, devops |
| 6. Publish solution | backend-architect | frontend-disciplinarian |
| 7. Gallery + detail | backend-architect | frontend-disciplinarian |
| 8. Feedback + endorsement | backend-architect | frontend-disciplinarian |
| 9. Tweak / fork | frontend-disciplinarian | backend-architect |
| 10. Polish + demo hardening | qa-reviewer | devops-engineer, sync-coordinator |

## Conflict resolution flow

```
1. Identify the mismatch (expected vs actual shape/behavior).
2. Check the spec. Is it specified?
   - Not specified  -> decide with both owners, write it into the spec.
   - Specified      -> the side that deviated conforms to the spec.
3. Update the spec + status board.
4. Confirm both owners are aligned before merging.
```


## Backend handoffs

### Task 2 — Seed data + Problems API

```text
ENDPOINT: GET /problems
REQUEST:  none
RESPONSE: 200 [ { id, title, hook, isWeekly } ] (weekly challenge first)
ERRORS:   500 { error: { code: "internal_error", message: "Unable to load problems. Try again shortly." } } on storage failure
NOTES:    DynamoDB TypeIndex query; catalog is seeded from backend/seed/problems.json.
          The JSON is authoritative: retained ids update, and omitted seeded problem ids retire.
          Current catalog: one weekly challenge + six persistent problems. Unit contract tests pass.
          Real DynamoDB Local smoke remains blocked until Docker Desktop's engine runs.

ENDPOINT: GET /problems/{id}
REQUEST:  path parameter `id`
RESPONSE: 200 { id, title, hook, description, constraints[], hintPills[], isWeekly }
ERRORS:   400 for blank id; 404 for an unknown id; 500 with the generic storage payload above
NOTES:    Input is trimmed before lookup. Frontend can consume these exact shapes through src/api.ts.
```


## Frontend handoffs

### Task 3 — Onboarding + Hub dashboard

```text
NEEDS:    GET /problems
SHAPE:    200 [ { id: string, title: string, hook: string, isWeekly: boolean } ]
          500 { error: { code: string, message: string } } on storage failure
BLOCKING: no — the Hub renders a retryable error state while the local DynamoDB seed/API path
          remains unavailable. A populated local demo still needs Docker Desktop running.
MOCK:     no production mock. Tests mock api.listProblems() only at the established src/api.ts seam.
NOTES:    The Hub selects the weekly hero using isWeekly rather than relying on list position,
          renders nonweekly entries as persistent cards, and routes to /problems/:id. Task 4
          replaces the deliberate placeholder at that route with problem detail + Studio.
```


### Task 4 — Problem detail + guided Studio

```text
NEEDS:    GET /problems/{id}
SHAPE:    200 { id, title, hook, description, constraints: string[], hintPills: string[], isWeekly }
          400/404/500 { error: { code: string, message: string } }
BLOCKING: no — the detail route has loading and retry/error states. A populated local route still
          needs the Docker-blocked Task 2 DynamoDB seed/API path.
MOCK:     no production mock. Detail-page tests mock api.getProblem() only at the src/api.ts seam.
NOTES:    Studio state uses the future request keys `api`, `processing`, `storage`, and
          `bottlenecks`. Hint clicks append their label to the active textarea. Task 5 must add
          the real POST /ai/diagram call and Mermaid renderer; Task 4 deliberately has no AI
          action or generated-looking diagram.
```
