# Project Spec — Claude Code Instructions

## MANDATORY: Use vector search before touching any spec files

**Every time** you need to find, understand, or check existing spec content — run this first:

```bash
node mcp/vector-server.js --search "your query" [--panel=<panel>] [--limit=10]
```

Valid panels: `requirements` · `backlog` · `sprints` · `technical` · `database` · `team` · `concept`

- Do **NOT** use an Agent, grep, or `read_spec` as the first step for discovery.
- Do **NOT** read `.spec/` files directly until vector search has been tried.
- If the command returns "No index found" → tell the user to click `$(layers)` in the VS Code Sync panel to build the index, then retry.
- Only fall back to `read_spec` when vector search returns no results or the index isn't built.

---

This workspace uses the **Project Spec** VS Code extension. All project documentation lives in the `.spec/` folder as YAML front-matter Markdown files.

Two MCP servers are bundled and auto-discovered via `.mcp.json`:
- `mcp/server.js` — read/write access to spec files
- `mcp/vector-server.js` — semantic search over spec content (requires Ollama + index built via VS Code)

---

## Available MCP tools

### Spec file tools (`project-spec` server)

| Tool | Purpose |
|------|---------|
| `read_spec` | Read all spec items across every type — use this first to see existing IDs |
| `get_schema` | Get the full schema reference: fields, statuses, relations, body templates |
| `query` | Filter items by `type` and/or `status` |
| `write_file` | Create or overwrite a `.spec/` file |
| `validate_file` | Validate a spec file after writing |
| `read_file` | Read the raw content of a single spec file |

### Semantic search — ALWAYS use this before reading spec files manually

**This is the primary way to find spec content. Use it before `read_spec`, `query`, or any file reads.**

The vector index lives at `.spec/.vector-index/`. Use this Bash command directly — it works even if the MCP server isn't loaded:

```bash
node mcp/vector-server.js --search "your query here"
# with panel filter:
node mcp/vector-server.js --search "your query here" --panel=technical
# with result limit:
node mcp/vector-server.js --search "your query here" --limit=10
```

Valid panel values: `requirements` · `backlog` · `sprints` · `technical` · `database` · `team` · `concept`

**When to run this:**
- Any time the user asks about existing requirements, decisions, architecture, or features
- Before creating new items — check for duplicates first
- When the user says "find", "search", "what do we have on", "is there a spec for"
- Before answering any question that might be addressed in the spec

**If it returns "No index found":** tell the user to click the `$(database)` icon in the relevant VS Code sidebar panel (or `$(layers)` in the Sync panel to reindex everything), then retry.

**If the MCP tools `semantic_search` / `reindex_vector_store` / `get_vector_status` appear in your tool list**, prefer those over the bash command — same functionality, cleaner output.

---

## Workflow for creating spec items

1. **Call `get_schema`** to get the correct front-matter fields, directory path, and ID conventions for the target type.
2. **Call `read_spec`** (or `query`) to find existing IDs and determine the next available sequential number.
3. **Call `write_file`** with the workspace-relative path (e.g. `.spec/backlog/epics/epic-004.md`) and the full file content.
4. **Call `validate_file`** with the same path to confirm the file is valid before moving on.

---

## TYPE REGISTRY — the only 17 valid document types

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
| `arch` | `ARCH-NNN` | `technical/` | `arch-NNN.md` | `draft` · `active` · `deprecated` |
| `service` | `SRV-NNN` | `technical/services/` | `srv-NNN.md` | `draft` · `active` · `deprecated` |
| `data-proc` | `DP-NNN` | `technical/data-processes/` | `dp-NNN.md` | `draft` · `active` · `deprecated` |
| `db-table` | `TBL-NNN` | `technical/database/` | `tbl-NNN.md` | `draft` · `active` · `done` |
| `cicd` | `CICD-NNN` | `technical/cicd/` | `cicd-NNN.md` | `draft` · `active` · `deprecated` |
| `auth-spec` | `AUTH-NNN` | `technical/auth/` | `auth-NNN.md` | `draft` · `active` · `deprecated` |
| `member` | `MBR-NNN` | `team/members/` | `mbr-NNN.md` | `active` · `draft` |
| `concept` | `CON-NNN` | `concept/{section}/` | `con-NNN.md` | `draft` · `active` · `deprecated` |

`NNN` = zero-padded 3-digit number (001, 002, …).
For `concept`, `{section}` ∈ `history` · `goals` · `principles` · `risks` · `sysdesign` · `sysimpl`.

---

## Front-matter quick reference

### Required fields (every type)
```yaml
id: EPIC-001        # uppercase — prefix from the Type Registry above
type: epic          # MUST be one of the 17 exact strings from the Type Registry
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

ADR/arch/service/cicd/auth-spec — standalone technical docs
  └─ may use dependsOn to reference tasks or other items
```

---

## Key rules

- **type is strictly enforced** — only the 17 exact strings in the Type Registry are valid. Never invent types.
- **Never** change an existing `id` — IDs are immutable.
- `title` must always be in double quotes in the front matter.
- Comma-separated fields (`linkedIds`, `dependsOn`, `relations`) must have **no spaces** around commas.
- Dates must be `YYYY-MM-DD` only.
- `epicId` is **required** on every story.
- `storyId` is **required** on every task and bug.
- `role` is **required** on every member.
- Always run `validate_file` after writing a new or edited spec file.
