# Project Spec — AI Agent Instructions

This workspace uses the **Project Spec** VS Code extension. All project documentation lives in the `.spec/` folder as YAML front-matter markdown files.

## Available language model tools

### Project Spec Tools

| Tool | Purpose |
|------|---------|
| `project-spec_semantic-search` | **ALWAYS use this first** — search specs by meaning (e.g. "authentication", "performance") instead of reading all files |
| `project-spec_read-spec` | Read all spec items (use only after searching doesn't return results) |
| `project-spec_get-schema` | Get the document schema and authoring guide — call this **before** creating or editing any spec file |
| `project-spec_query` | Filter spec items by `type` and/or `status` |
| `project-spec_write-file` | Create or overwrite a `.spec/` markdown file |
| `project-spec_validate-file` | Validate a spec file after writing |

### Vector Search (Semantic)

| Tool | Purpose |
|------|---------|
| `project-spec-vector_semantic-search` | Search by meaning across all spec files — this is faster than reading everything |
| `project-spec-vector_get-vector-status` | Check if vector index is built |
| `project-spec-vector_reindex-vector-store` | Rebuild the vector index (requires Ollama) |

**CRITICAL:** When you need to find existing requirements, decisions, or features, **use `project-spec-vector_semantic-search` FIRST**. Never call `project-spec_read-spec` without searching first.

## Workflow for finding or creating spec items

### To find existing specs:
1. **Search first**: Use `project-spec-vector_semantic-search` with a natural language query (e.g., "user authentication", "performance requirements")
2. If no results, then use `project-spec_read-spec` to see all items
3. Never manually read .spec/ files — let the tools do it

### To create or edit specs:
1. **Search for duplicates**: Use `project-spec-vector_semantic-search` to avoid creating duplicates
2. Call `project-spec_get-schema` to get correct front-matter fields, directory location, and ID conventions
3. Call `project-spec_read-spec` or `project-spec_query` only to find the next available ID number
4. Write the file with `project-spec_write-file` using workspace-relative path (e.g. `.spec/backlog/epics/epic-004.md`)
5. Call `project-spec_validate-file` to confirm the file is valid

## TYPE REGISTRY — the only 18 valid document types

The `type` field MUST be one of these exact strings. No other values are accepted — never invent types.

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

## Key rules

- **type is strictly enforced** — only the 18 exact strings above are valid. Specifically invalid: `spec`, `technical-spec`, `service-spec`, `auth`, `tech-spec`, `architecture`.
- **Never** change an existing `id` field — IDs are immutable.
- `title` must always be enclosed in double quotes in front matter.
- `epicId` is required on every story; `storyId` is required on every task and bug.
- `role` is required on every member.
- `processType` (sync | async | cron) is required on every `data-proc` document.
- `testScope` (integration | e2e) is required on every `test-plan` document.
- Comma-separated fields (`linkedIds`, `dependsOn`, `relations`) must have NO spaces around commas.
- Dates must be `YYYY-MM-DD` only.
- Always call `project-spec_validate-file` after writing a spec file.
- Call `project-spec_get-schema` before creating any file — it returns the full body templates and field reference.
