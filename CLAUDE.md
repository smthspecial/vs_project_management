# Project Spec — Claude Code Instructions

This workspace uses the **Project Spec** VS Code extension. All project documentation lives in the `.spec/` folder as YAML front-matter Markdown files.

An MCP server is bundled at `mcp/server.js` and auto-discovered via `.mcp.json`. It gives you direct read/write access to the spec files without requiring VS Code.

---

## Available MCP tools

| Tool | Purpose |
|------|---------|
| `read_spec` | Read all spec items across every type — use this first to see existing IDs |
| `get_schema` | Get the full schema reference: fields, statuses, relations, body templates |
| `query` | Filter items by `type` and/or `status` |
| `write_file` | Create or overwrite a `.spec/` file |
| `validate_file` | Validate a spec file after writing |
| `read_file` | Read the raw content of a single spec file |

---

## Workflow for creating spec items

1. **Call `get_schema`** to get the correct front-matter fields, directory path, and ID conventions for the target type.
2. **Call `read_spec`** (or `query`) to find existing IDs and determine the next available sequential number.
3. **Call `write_file`** with the workspace-relative path (e.g. `.spec/backlog/epics/epic-004.md`) and the full file content.
4. **Call `validate_file`** with the same path to confirm the file is valid before moving on.

---

## Document types and IDs

| Type | ID prefix | Directory | File pattern |
|------|-----------|-----------|--------------|
| `epic` | `EPIC-` | `.spec/backlog/epics/` | `epic-NNN.md` |
| `story` | `US-` | `.spec/backlog/stories/` | `us-NNN.md` |
| `task` | `TASK-` | `.spec/backlog/tasks/` | `task-NNN.md` |
| `bug` | `BUG-` | `.spec/backlog/tasks/` | `bug-NNN.md` |
| `fr` | `FR-` | `.spec/requirements/fr/` | `fr-NNN.md` |
| `nfr` | `NFR-` | `.spec/requirements/nfr/` | `nfr-NNN.md` |
| `sprint` | `SPR-` | `.spec/planning/sprints/` | `spr-NNN.md` |
| `release` | `REL-` | `.spec/planning/releases/` | `rel-NNN.md` |
| `adr` | `ADR-` | `.spec/technical/adr/` | `adr-NNN.md` |
| `arch` | `ARCH-` | `.spec/technical/architecture/` | `arch-NNN.md` |
| `tech-spec` | `SPEC-` | `.spec/technical/specs/` | `spec-NNN.md` |
| `db-table` | `TBL-` | `.spec/technical/database/` | `tbl-NNN.md` |
| `cicd` | `CICD-` | `.spec/technical/cicd/` | `cicd-NNN.md` |
| `auth-spec` | `AUTH-` | `.spec/technical/auth/` | `auth-NNN.md` |
| `member` | `MBR-` | `.spec/team/members/` | `mbr-NNN.md` |

`NNN` is a zero-padded 3-digit sequential number (001, 002, …).

---

## Front-matter quick reference

### Required fields (every type)
```yaml
id: EPIC-001        # uppercase, matches type prefix
type: epic          # one of the 15 type values
title: "My title"   # MUST be in double quotes
status: draft       # see valid values below
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
startDate: 2026-01-15   # ISO date
dueDate: 2026-01-28     # ISO date
releaseDate: 2026-06-30 # ISO date (release only)
relations: userId:TBL-001,orderId:TBL-002  # FK refs (db-table only)
```

### Valid statuses per type

| Type | Valid statuses |
|------|---------------|
| epic, story | `draft` · `active` · `done` |
| task, bug | `todo` · `in-progress` · `testing` · `blocked` · `done` |
| fr, nfr, arch, tech-spec, cicd, auth-spec | `draft` · `active` · `deprecated` |
| adr | `proposed` · `accepted` · `deprecated` · `superseded` |
| db-table | `draft` · `active` · `done` |
| sprint | `planned` · `active` · `done` |
| release | `draft` · `active` · `released` |
| member | `active` · `draft` |

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

ADR/arch/tech-spec/cicd/auth-spec — standalone technical docs
  └─ may use dependsOn to reference tasks or other items
```

---

## Key rules

- **Never** change an existing `id` — IDs are immutable.
- `title` must always be in double quotes in the front matter.
- Comma-separated fields (`linkedIds`, `dependsOn`, `relations`) must have **no spaces** around commas.
- Dates must be `YYYY-MM-DD` only.
- `epicId` is **required** on every story.
- `storyId` is **required** on every task and bug.
- `role` is **required** on every member.
- Always run `validate_file` after writing a new or edited spec file.
