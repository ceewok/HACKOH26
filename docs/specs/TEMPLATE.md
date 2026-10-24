# Spec: <Feature Name>

> Copy this file to `docs/specs/<feature-name>.md` and fill it in.
> Keep it current as the single source of truth for this feature.

- **Status:** draft | in progress | built | demoed
- **Owner(s):**
- **Last updated:**

---

## 1. Problem & Goal

What are we solving, and what does success look like? One or two sentences.

## 2. Requirements

User-facing behavior, as testable statements.

- As a user, I can ...
- As a user, I can ...

**Non-goals:** (what we're explicitly not doing)

## 3. Design

How it works at a high level. Diagrams/notes welcome. Keep it short.

- **Data flow:**
- **Key decisions:**
- **Open questions:**

## 4. Contract (single source of truth)

> Backend implements this; frontend consumes it. Changes here must be announced
> to the `sync-coordinator`.

### Data models

```
<Model name>
  field: type   // notes
```

### Endpoints

```
<METHOD> /path
REQUEST:  <body/query shape + example>
RESPONSE: <success shape + example>
ERRORS:   <status codes and when they occur>
AUTH:     <required? how?>
```

## 5. Tasks

Break the work into small, ownable pieces.

- [ ] (backend) ...
- [ ] (frontend) ...
- [ ] (devops) ...
- [ ] (qa) ...

## 6. Notes / Decisions log

Running log of anything non-obvious decided along the way.

- _date_ — _decision / change_
