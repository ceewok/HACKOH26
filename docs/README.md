# Docs

Project documentation lives here.

## Structure

- `specs/` — feature specifications. Each idea/feature gets its own spec file
  describing requirements, design, and the API/data contract agents build against.
  Start new specs from `specs/TEMPLATE.md`.

## How specs are used

1. Once the project idea is chosen, copy `specs/TEMPLATE.md` to
   `specs/<feature-name>.md` and fill it in.
2. The `backend-architect` and `frontend-disciplinarian` build against the
   **Contract** section. It is the single source of truth.
3. The `sync-coordinator` keeps the contract current and resolves mismatches.
4. Update the spec to reflect what was actually built — not just what was planned.

## Index

| Spec | Status | Owner |
|------|--------|-------|
| [bridge-builder](specs/bridge-builder.md) | in progress | multi-agent |
