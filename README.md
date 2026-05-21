# Project Spec

A VS Code extension for managing your project's full specification directly in your workspace. Requirements, epics, user stories, tasks, sprints, ADRs, architecture docs, and database schema — all stored as plain Markdown files in a `.spec/` folder.

---

## Getting Started

1. Open a workspace folder in VS Code.
2. Click the **Project Spec** icon in the Activity Bar (left sidebar).
3. Use the `+` buttons or Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) to create your first items.

All data lives in `.spec/` at the root of your workspace — commit it to version control just like code.

---

## Folder Structure

```
.spec/
├── requirements/
│   ├── fr/           ← Functional Requirements (FR-001.md, …)
│   └── nfr/          ← Non-Functional Requirements (NFR-001.md, …)
├── planning/
│   ├── epics/        ← Epics (EPIC-001.md, …)
│   ├── stories/      ← User Stories (US-001.md, …)
│   └── tasks/        ← Tasks & Bugs (TASK-001.md, BUG-001.md, …)
├── sprints/          ← Sprints (SPR-001.md, …)
├── releases/         ← Releases (REL-001.md, …)
├── technical/
│   ├── adr/          ← Architecture Decision Records (ADR-001.md, …)
│   ├── architecture/ ← Architecture Docs
│   └── specs/        ← Technical Specifications
├── database/         ← Database Tables (TBL-001.md, …)
└── team/             ← Team Members (MBR-001.md, …)
```

Each file is a standard Markdown document with a YAML front matter block at the top:

```yaml
---
id: US-003
type: story
title: User can reset their password
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

Click the **Project Spec** icon in the Activity Bar to open the sidebar. Six sections are available:

| Panel | Contents |
|---|---|
| **Requirements** | Functional (FR) and Non-Functional (NFR) requirements |
| **Backlog** | Epics → User Stories → Tasks & Bugs, in a hierarchy |
| **Sprints & Releases** | Sprints and release milestones |
| **Technical** | ADRs, Architecture docs, Technical Specifications |
| **Database** | Database table definitions |
| **Team** | Team members and roles |

Click any item to open its source Markdown file. Right-click for context actions (change status, add dependency, assign to sprint, delete, etc.).

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

- **Story bars** — drag left/right to shift the item's start and due dates.
- **Sprint bands** — shown as colored bands in the header row:
  - **Hover** to see the sprint name and exact date range in a tooltip.
  - **Click** (without dragging) to open the sprint's Markdown file.
  - **Drag the band body** left/right to move the entire sprint.
  - **Drag the left/right edge handles** to resize the sprint start or end date.
- **Unscheduled items** — appear in the left panel; drag them onto the chart to assign dates.
- **Dependency arrows** — connect items that have `dependsOn` set.
- The timeline auto-scrolls to today on first open.

### Dependencies

Graph view of all items with dependency links. Arrows flow from prerequisites to dependents, giving you a clear picture of blocking relationships.

### Database

Visual entity-relationship diagram showing database tables, their columns, types, and foreign key arrows.

- Drag tables to rearrange the layout.
- Click a table name to open its Markdown file.
- Use the **New Table** toolbar button to add a table.
- Use the **Auto-layout** button to reset positions.

---

## Commands

All commands are available via the Command Palette under **Project Spec**:

| Command | Description |
|---|---|
| **New Epic** | Create a new Epic |
| **New User Story** | Create a User Story under an Epic |
| **New Task** | Create a Task under a User Story |
| **New Bug** | Create a Bug under a User Story |
| **New Functional Requirement** | Create a Functional Requirement |
| **New Non-Functional Requirement** | Create a Non-Functional Requirement |
| **New ADR** | Create an Architecture Decision Record |
| **New Architecture Doc** | Create an Architecture document |
| **New Technical Specification** | Create a Technical Specification |
| **New Sprint** | Create a Sprint with start/end dates |
| **New Release** | Create a Release milestone |
| **New Table** | Create a Database Table |
| **Change Status…** | Change the status of any item |
| **Add Dependency…** | Mark an item as depending on another |
| **Add to Sprint…** | Assign a story/task/bug to a sprint |
| **Add to Release…** | Assign a story/task/bug to a release |
| **Open Project View** | Open the visual Board / Timeline / Dependencies / Database panel |
| **Refresh** | Reload all data from `.spec/` files |

---

## Item Statuses

| Type | Statuses |
|---|---|
| Epic, Story | `draft` → `active` → `done` |
| Task, Bug | `todo` → `in-progress` → `testing` → `blocked` → `done` |
| FR, NFR | `draft` → `active` → `done` |
| ADR | `proposed` → `accepted` → `deprecated` → `superseded` |
| Sprint | `planned` → `active` → `done` |
| Release | `draft` → `active` → `released` |

---

## CodeLens & Navigation

In any `.spec/**/*.md` file, CodeLens actions appear above the front matter:

- **Change Status** — change the item's status without opening the YAML manually.
- **Add Dependency** — link this item as depending on another.

`Ctrl+Click` (or `Cmd+Click`) any item ID anywhere in a spec file (e.g. `US-003`, `EPIC-001`, `SPR-002`) to jump directly to that item's file.

---

## AI / Copilot Integration

Project Spec registers a **language model tool** named `project-spec_read-spec` that GitHub Copilot (and other VS Code AI assistants) can call to retrieve the full project specification at any time.

### How it works

When you ask Copilot a question about your project while coding, it can automatically call this tool to understand your requirements, epics, stories, sprints, and architecture decisions — then give you contextually accurate answers.

**Example questions you can ask in Copilot Chat:**

> *"What user stories are planned for Sprint 2?"*

> *"Which tasks are currently blocked, and what do they depend on?"*

> *"Summarise the functional requirements for the authentication feature."*

> *"What does our database schema look like?"*

### Manual use

You can also reference the tool explicitly in Copilot Chat:

```
#project-spec_read-spec List all epics and their current status
```

```
#project-spec_read-spec What ADRs have been accepted?
```

The tool returns all items — requirements, epics, stories, tasks, sprints, releases, ADRs, database tables, and team members — structured as Markdown so the AI can reason over them accurately.

---

## Release Notes

### 0.0.1

Initial release — requirements, backlog, sprints, technical docs, database schema, team, visual board, timeline, dependency graph, and Copilot integration.


* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
