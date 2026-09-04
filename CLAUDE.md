# Project Spec — Claude Code Instructions

This workspace uses the **Project Spec** VS Code extension. All project documentation lives in the `.spec/` folder as YAML front-matter Markdown files. There's no MCP server and no special read/write/search tool — use your normal Read/Write/Edit/Grep/Glob tools directly on `.spec/`, guided by the Type Registry below.

## Finding existing spec content

Before creating a new item, check whether one already exists:

- `Grep` for keywords across `.spec/**/*.md`, or `Glob` a specific type's directory (e.g. `.spec/backlog/epics/*.md`) when you already know the type.
- Check `linkedIds` / `dependsOn` / `epicId` / `storyId` front matter to trace relationships between items.

---

## Workflow for creating spec items

1. Check the **Type Registry** below for the correct front-matter fields, directory path, file name, and ID convention for the target type.
2. List existing files of that type (e.g. `ls .spec/backlog/epics/`) to find existing IDs and determine the next available sequential number.
3. Write the file directly at its workspace-relative path (e.g. `.spec/backlog/epics/epic-004.md`).
4. Re-read the file and check it against **Key Rules** below before moving on — there's no separate validation tool, so this pass is on you.

---

## TYPE REGISTRY — the only 18 valid document types

The `type` field MUST be one of these exact strings. No other values are accepted.
Never invent types — `spec`, `technical-spec`, `service-spec`, `auth`, `tech-spec` are all invalid.

| `type` | `id` prefix | Directory under `.spec/` | File name | Valid `status` values |
|--------|-------------|--------------------------|-----------|----------------------|
| `epic` | `EPIC-NNN` | `backlog/epics/` | `epic-NNN.md` | `draft` · `active` · `done` |
| `story` | `US-NNN` | `backlog/stories/` | `us-NNN.md` | `draft` · `active` · `done` |
| `task` | `TASK-NNN` | `backlog/tasks/` | `task-NNN.md` | `todo` · `in-progress` · `testing` · `blocked` · `done` |
| `bug` | `BUG-NNN` | `backlog/tasks/` | `bug-NNN.md` | `todo` · `in-progress` · `testing` · `blocked` · `done` |
| `fr` | `FR-NNN` | `requirements/fr/` | `fr-NNN.md` | `draft` · `active` · `deprecated` |
| `nfr` | `NFR-NNN` | `requirements/nfr/` | `nfr-NNN.md` | `draft` · `active` · `deprecated` |
| `sprint` | `SPR-NNN` | `planning/sprints/` | `spr-NNN.md` | `planned` · `active` · `done` |
| `release` | `REL-NNN` | `planning/releases/` | `rel-NNN.md` | `draft` · `active` · `released` |
| `adr` | `ADR-NNN` | `technical/adr/` | `adr-NNN.md` | `proposed` · `accepted` · `deprecated` · `superseded` |
| `arch` | `ARCH-NNN` | `technical/arch/` | `arch-NNN.md` | `draft` · `active` · `deprecated` |
| `service` | `SRV-NNN` | `technical/services/` | `srv-NNN.md` | `draft` · `active` · `deprecated` |
| `data-proc` | `DP-NNN` | `technical/data-processes/` | `dp-NNN.md` | `draft` · `active` · `deprecated` |
| `db-table` | `TBL-NNN` | `technical/database/` | `tbl-NNN.md` | `draft` · `active` · `done` |
| `cicd` | `CICD-NNN` | `technical/cicd/` | `cicd-NNN.md` | `draft` · `active` · `deprecated` |
| `auth-spec` | `AUTH-NNN` | `technical/auth/` | `auth-NNN.md` | `draft` · `active` · `deprecated` |
| `test-plan` | `TP-NNN` | `technical/test-plans/` | `tp-NNN.md` | `draft` · `active` · `deprecated` |
| `member` | `MBR-NNN` | `team/members/` | `mbr-NNN.md` | `active` · `draft` |
| `concept` | `CON-NNN` | `concept/{section}/` | `con-NNN.md` | `draft` · `active` · `deprecated` |

`NNN` = zero-padded 3-digit number (001, 002, …).
For `concept`, `{section}` ∈ `history` · `goals` · `principles` · `risks` · `sysdesign` · `sysimpl`.

---

## Front-matter quick reference

### Required fields (every type)
```yaml
id: EPIC-001        # uppercase — prefix from the Type Registry above
type: epic          # MUST be one of the 18 exact strings from the Type Registry
title: "My title"   # MUST be in double quotes
status: draft       # MUST be one of the valid statuses for this type (see Type Registry)
created: 2026-01-15 # ISO date YYYY-MM-DD
```

### Relational fields

```yaml
epicId: EPIC-001        # story → epic (REQUIRED on story)
storyId: US-001         # task/bug → story (REQUIRED on task and bug)
sprintId: SPR-001       # assigns to a sprint
releaseId: REL-001      # assigns to a release
linkedIds: FR-001,US-002  # fr/nfr links (comma-separated, NO spaces)
dependsOn: TASK-002,TASK-003  # prerequisites (comma-separated, NO spaces)
assigneeId: MBR-001     # task/bug → team member
role: frontend          # member role (REQUIRED on member)
priority: high          # high | medium | low
startDate: 2026-01-15   # ISO date YYYY-MM-DD
dueDate: 2026-01-28     # ISO date YYYY-MM-DD
releaseDate: 2026-06-30 # ISO date YYYY-MM-DD (release only)
relations: userId:TBL-001,orderId:TBL-002  # FK refs (db-table only, NO spaces)
processType: async                         # data-proc — sync | async | cron (REQUIRED on data-proc)
testScope: e2e                             # test-plan — integration | e2e (REQUIRED on test-plan)
```

---

## Relationship map

```
FR/NFR ──linkedIds──► Story/Task/Epic

Epic ◄──epicId── Story ◄──storyId── Task/Bug
                   │                    │
                sprintId            assigneeId
                   │                    │
                 Sprint               Member
                   │
                releaseId
                   │
                Release

db-table ──relations──► db-table   (FK references)

ADR/arch/service/cicd/auth-spec/test-plan — standalone technical docs
  └─ may use dependsOn to reference tasks or other items
  └─ test-plan may use linkedIds to reference the story/epic it covers
```

---

## Key rules

- **type is strictly enforced** — only the 18 exact strings in the Type Registry are valid. Never invent types.
- **Never** change an existing `id` — IDs are immutable.
- `title` must always be in double quotes in the front matter.
- Comma-separated fields (`linkedIds`, `dependsOn`, `relations`) must have **no spaces** around commas.
- Dates must be `YYYY-MM-DD` only.
- `epicId` is **required** on every story.
- `storyId` is **required** on every task and bug.
- `role` is **required** on every member.
- `processType` (`sync` | `async` | `cron`) is **required** on every `data-proc`.
- `testScope` (`integration` | `e2e`) is **required** on every `test-plan`.
- There's no validation tool — re-read what you wrote and check it against these rules by hand.
