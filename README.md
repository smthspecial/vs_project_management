# Project Spec

A VS Code extension for managing your project's full specification directly in your workspace. Requirements, epics, user stories, tasks, sprints, ADRs, architecture docs, database schema, and product concept — all stored as plain Markdown files in a `.spec/` folder, committed alongside your code.

---

## Getting Started

1. Open a workspace folder in VS Code.
2. Click the **Project Spec** icon in the Activity Bar (left sidebar).
3. Use the `+` buttons in any panel, or the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`), to create your first items.

All data lives in `.spec/` at the root of your workspace — commit it to version control just like code.

---

## Folder Structure

```
.spec/
├── requirements/
│   ├── fr/                   ← Functional Requirements (fr-001.md, …)
│   └── nfr/                  ← Non-Functional Requirements (nfr-001.md, …)
├── backlog/
│   ├── epics/                ← Epics (epic-001.md, …)
│   ├── stories/              ← User Stories (us-001.md, …)
│   └── tasks/                ← Tasks & Bugs (task-001.md, bug-001.md, …)
├── planning/
│   ├── sprints/              ← Sprints (spr-001.md, …)
│   └── releases/             ← Release milestones (rel-001.md, …)
├── technical/
│   ├── adr/                  ← Architecture Decision Records (adr-001.md, …)
│   ├── arch/                 ← Architecture documents (arch-001.md, …)
│   ├── services/             ← Service definitions (srv-001.md, …)
│   ├── data-processes/       ← Data pipelines (dp-001.md, …)
│   ├── database/             ← Database tables (tbl-001.md, …)
│   ├── cicd/                 ← CI/CD pipeline docs (cicd-001.md, …)
│   └── auth/                 ← Auth specifications (auth-001.md, …)
├── team/
│   └── members/              ← Team members (mbr-001.md, …)
└── concept/
    ├── history/              ← History & problem statements
    ├── goals/                ← Product goals
    ├── principles/           ← Core principles
    ├── risks/                ← Risks & obstacles
    ├── sysdesign/            ← System design overview
    └── sysimpl/              ← System implementation notes
```

Each file is a Markdown document with a YAML front-matter block:

```yaml
---
id: US-003
type: story
title: "User can reset their password"
status: active
epicId: EPIC-001
priority: high
sprintId: SPR-002
startDate: 2026-05-01
dueDate: 2026-05-14
---

## Description
...
```

---

## Sidebar Panels

Click the **Project Spec** icon in the Activity Bar to open the sidebar. Eight panels are available:

| Panel | Contents |
|---|---|
| **Sync** | Git integration — commit, push, pull, and open PRs for spec changes |
| **Requirements** | Functional (FR) and Non-Functional (NFR) requirements |
| **Backlog** | Epics → User Stories → Tasks & Bugs, in a hierarchy |
| **Sprints & Releases** | Sprints and release milestones |
| **Technical** | ADRs, Architecture docs, Services, Data Processes, CI/CD, Auth specs |
| **Database** | Database table definitions with column and FK details |
| **Team** | Team members and their roles |
| **Concept** | Product concept — history, goals, principles, risks, system design, system implementation |

Click any item to open its source Markdown file. Right-click for context actions (change status, add dependency, assign to sprint, delete, etc.).

---

## Sync Panel

The **Sync** panel provides built-in Git integration scoped to your `.spec/` folder so spec changes can be reviewed and shipped independently.

| Action | Command |
|---|---|
| **Commit Spec Changes…** | Stage and commit only `.spec/` files with a message |
| **Push Branch** | Push the current branch to remote |
| **Pull from Remote** | Pull latest changes |
| **Open Pull Request** | Open a PR for the current branch |
| **Refresh Sync Status** | Refresh the panel's git status display |

---

## Project View

Click the **$(project) Open Project View** button in any sidebar panel header to open the visual planning board. Four tabs are available:

### Board

Kanban board showing all tasks and bugs in status columns: **To Do → In Progress → Testing → Done → Blocked**.

- Filter by Sprint, Release, or Assignee using the dropdowns at the top.
- Drag cards between columns to update their status.
- Use the status dropdown on each card for a quick inline change.
- Click a card title to open its Markdown file.

### Timeline

Gantt-style chart showing user stories as bars, sprint bands, and release markers.

- **Story bars** — drag left/right to shift start and due dates.
- **Sprint bands** — shown as colored bands in the header row:
  - **Hover** to see the sprint name and date range.
  - **Click** to open the sprint's Markdown file.
  - **Drag the band body** left/right to move the entire sprint.
  - **Drag the left/right edge handles** to resize the sprint.
- **Unscheduled items** — appear in the left panel; drag onto the chart to assign dates.
- **Dependency arrows** — connect items that have `dependsOn` set.
- The timeline auto-scrolls to today on first open.

### Dependencies

Graph view of all items with dependency links. Arrows flow from prerequisites to dependents, giving a clear picture of blocking relationships.

### Database

Visual entity-relationship diagram showing database tables, their columns, types, and foreign key arrows.

- Drag tables to rearrange the layout.
- Click a table name to open its Markdown file.
- Use the **New Table** toolbar button to add a table.
- Use the **Auto-layout** button to reset positions.

---

## Commands

All commands are available via the Command Palette under **Project Spec**:

**Backlog**

| Command | Description |
|---|---|
| **New Epic** | Create a new Epic |
| **New User Story** | Create a User Story under an Epic |
| **New Task** | Create a Task under a User Story |
| **New Bug** | Create a Bug under a User Story |

**Requirements**

| Command | Description |
|---|---|
| **New Functional Requirement** | Create a Functional Requirement (FR) |
| **New Non-Functional Requirement** | Create a Non-Functional Requirement (NFR) |

**Planning**

| Command | Description |
|---|---|
| **New Sprint** | Create a Sprint with start/end dates |
| **New Release** | Create a Release milestone |
| **Add to Sprint…** | Assign a story/task/bug to a sprint |
| **Add to Release…** | Assign a story/task/bug to a release |

**Technical**

| Command | Description |
|---|---|
| **New ADR** | Create an Architecture Decision Record |
| **New Architecture Doc** | Create an Architecture document |
| **New Technical Specification** | Create a Technical Specification |
| **New Data Process** | Create a Data Process doc (sync/async/cron) |
| **New CI/CD Pipeline Doc** | Create a CI/CD pipeline document |
| **New Auth Specification** | Create an Auth Specification |

**Database & Team**

| Command | Description |
|---|---|
| **New Table** | Create a Database Table definition |
| **New Team Member** | Create a Team Member record |

**Concept**

| Command | Description |
|---|---|
| **New History & Problem Document** | Document the origin and problem space |
| **New Goals Document** | Define product goals |
| **New Core Principles Document** | Capture guiding principles |
| **New Risks & Obstacles Document** | Track risks |
| **New System Design Document** | High-level system design |
| **New System Implementation Document** | Implementation notes |

**General**

| Command | Description |
|---|---|
| **Change Status…** | Change the status of any item |
| **Add Dependency…** | Mark an item as depending on another |
| **Open Project View** | Open the visual Board / Timeline / Dependencies / Database panel |
| **Open Board View** | Open directly to the Kanban board tab |
| **Open Timeline View** | Open directly to the Timeline tab |
| **Open Database View** | Open directly to the Database ER diagram tab |
| **Refresh** | Reload all data from `.spec/` files |

---

## Item Statuses

| Type | Statuses |
|---|---|
| Epic, Story | `draft` → `active` → `done` |
| Task, Bug | `todo` → `in-progress` → `testing` → `blocked` → `done` |
| FR, NFR | `draft` → `active` → `deprecated` |
| ADR | `proposed` → `accepted` → `deprecated` → `superseded` |
| Sprint | `planned` → `active` → `done` |
| Release | `draft` → `active` → `released` |
| Arch, Service, Data Process, CI/CD, Auth | `draft` → `active` → `deprecated` |
| DB Table | `draft` → `active` → `done` |
| Member | `draft` → `active` |
| Concept | `draft` → `active` → `deprecated` |

---

## CodeLens & Navigation

In any `.spec/**/*.md` file, CodeLens actions appear above the front matter:

- **Change Status** — change the item's status without editing YAML manually.
- **Add Dependency** — link this item as depending on another.

`Ctrl+Click` (or `Cmd+Click`) any item ID anywhere in a spec file (e.g. `US-003`, `EPIC-001`, `SPR-002`) to jump directly to that item's file.

---

## AI Integration

Project Spec ships with two bundled MCP servers and exposes eight language model tools, enabling AI assistants — including GitHub Copilot, Claude Code, and any VS Code AI extension — to read and write your spec directly.

### MCP Servers

Two servers are auto-discovered via `.mcp.json` in your workspace:

| Server | Purpose |
|---|---|
| `mcp/server.js` | Full read/write access to spec files |
| `mcp/vector-server.js` | Semantic search over spec content (requires vector index) |

### Language Model Tools

Eight tools are registered for use by any compatible AI assistant:

| Tool | Description |
|---|---|
| `project-spec_read-spec` | Read all spec items across every type |
| `project-spec_get-schema` | Get the full schema: fields, statuses, relations, body templates |
| `project-spec_query` | Filter items by type and/or status |
| `project-spec_write-file` | Create or overwrite a spec file |
| `project-spec_validate-file` | Validate a spec file's front matter |
| `project-spec-vector_semantic-search` | Semantic search over spec content by meaning |
| `project-spec-vector_get-vector-status` | Check the vector index status per panel |
| `project-spec-vector_reindex-vector-store` | Rebuild the vector index for one or all panels |

### Semantic Search (Vector Index)

The vector index enables natural-language search across your spec. It requires [Ollama](https://ollama.com) running locally with an embedding model.

**Building the index:**

1. Install Ollama and pull an embedding model (e.g. `ollama pull nomic-embed-text`).
2. Open VS Code with this extension active.
3. Run **Reindex All Vector Stores** from the Command Palette — or click the `$(layers)` icon in the Sync panel — to build the index for all panels.
4. Individual panels can be reindexed via their `$(database)` icon or via the per-panel reindex commands.

**Using search from the terminal or Claude Code:**

```bash
node mcp/vector-server.js --search "authentication flow"
node mcp/vector-server.js --search "payment processing" --panel=technical
node mcp/vector-server.js --search "sprint goals" --panel=sprints --limit=5
```

Valid `--panel` values: `requirements` · `backlog` · `sprints` · `technical` · `database` · `team` · `concept`

### Copilot Chat

When you ask Copilot a question about your project, it can call the registered tools to pull in your requirements, epics, stories, sprints, and architecture decisions automatically.

**Example questions:**

> *"What user stories are planned for Sprint 2?"*

> *"Which tasks are currently blocked, and what do they depend on?"*

> *"Summarize the functional requirements for the authentication feature."*

> *"What does our database schema look like?"*

**Explicit tool use in Copilot Chat:**

```
#project-spec_read-spec List all epics and their current status
#project-spec_query Show all tasks with status in-progress
```

### Initializing Copilot Instructions

Run **Initialize Copilot Instructions** from the Command Palette to generate a `.github/copilot-instructions.md` file in your workspace. This primes Copilot to use the spec tools automatically on every request so you don't have to reference them manually.

---

## Using with Claude Code

If you use [Claude Code](https://claude.ai/code), the MCP servers in `.mcp.json` are auto-loaded. Claude will:

1. Run semantic search first to find relevant spec content by meaning.
2. Use `read_spec` or `query` to check existing IDs before creating new items.
3. Write and validate new spec files using `write_file` and `validate_file`.

You can interact naturally:

> *"Create a user story for password reset under EPIC-002 and assign it to the current sprint."*

> *"What ADRs cover our database choice?"*

> *"Add a task for implementing rate limiting, blocked by TASK-012."*

---

## Release Notes

### 0.0.11
- Concept panel with six sub-types (history, goals, principles, risks, system design, system implementation)
- Sync panel with built-in Git operations scoped to `.spec/`
- Vector search via bundled `mcp/vector-server.js` and Ollama
- Eight AI language model tools (read, write, validate, query, search, reindex)
- New document types: Data Process, CI/CD Pipeline, Auth Specification, Service
- New Team Member document type
- Direct commands to open Board, Timeline, and Database views
- Initialize Copilot Instructions command

### 0.0.1
Initial release — requirements, backlog, sprints, technical docs, database schema, team, visual board, timeline, dependency graph, and Copilot integration.
