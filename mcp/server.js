#!/usr/bin/env node
"use strict";

/**
 * Project Spec — MCP Server
 *
 * Exposes the Project Spec extension tools over the Model Context Protocol
 * so that Claude Code (and any other MCP-compatible AI client) can read,
 * query, write, and validate `.spec/` files.
 *
 * Transport: JSON-RPC 2.0 over stdio (newline-delimited JSON)
 * Run from the workspace root:  node mcp/server.js
 */

const readline = require("readline");
const fs = require("fs");
const path = require("path");

const workspaceRoot = process.cwd();

// ---------------------------------------------------------------------------
// Spec parsing (ported from src/specParser.ts)
// ---------------------------------------------------------------------------

function parseFrontMatter(content) {
  const match = content.match(
    /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/,
  );
  if (!match) return { data: {}, body: content };

  const yamlBlock = match[1];
  const body = match[2] ?? "";
  const raw = {};

  for (const line of yamlBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx <= 0) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed
      .slice(colonIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    raw[key] = value;
  }

  return {
    data: {
      id: raw["id"],
      type: raw["type"],
      title: raw["title"],
      status: raw["status"] ?? "draft",
      created: raw["created"],
      epicId: raw["epicId"],
      storyId: raw["storyId"],
      linkedIds: raw["linkedIds"],
      dependsOn: raw["dependsOn"],
      sprintId: raw["sprintId"],
      releaseId: raw["releaseId"],
      startDate: raw["startDate"],
      dueDate: raw["dueDate"],
      releaseDate: raw["releaseDate"],
      relations: raw["relations"],
      priority: raw["priority"],
      assigneeId: raw["assigneeId"],
      role: raw["role"],
    },
    body,
  };
}

function parseSpecFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const { data, body } = parseFrontMatter(content);
    if (!data.id || !data.type || !data.title) return null;
    return { filePath, data, body };
  } catch {
    return null;
  }
}

const SPEC_SUBDIRS = [
  "requirements/fr",
  "requirements/nfr",
  "backlog/epics",
  "backlog/stories",
  "backlog/tasks",
  "planning/sprints",
  "planning/releases",
  "technical/adr",
  "technical",
  "technical/data-processes",
  "technical/services",
  "technical/database",
  "technical/cicd",
  "technical/auth",
  "team/members",
  "concept/history",
  "concept/goals",
  "concept/principles",
  "concept/risks",
  "concept/sysdesign",
  "concept/sysimpl",
];

function readAllSpecItems() {
  const specDir = path.join(workspaceRoot, ".spec");
  if (!fs.existsSync(specDir)) return [];

  const items = [];
  for (const subdir of SPEC_SUBDIRS) {
    const dirPath = path.join(specDir, subdir);
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath)) {
      if (!file.endsWith(".md")) continue;
      const item = parseSpecFile(path.join(dirPath, file));
      if (item) items.push(item);
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Build spec content (ported from src/specTool.ts)
// ---------------------------------------------------------------------------

const TYPE_LABELS = {
  fr: "Functional Requirements",
  nfr: "Non-Functional Requirements",
  epic: "Epics",
  story: "User Stories",
  task: "Tasks",
  bug: "Bugs",
  sprint: "Sprints",
  release: "Releases",
  adr: "Architecture Decision Records",
  arch: "Architecture Docs",
  "service": "Services",
  "data-proc": "Data Processes",
  "db-table": "Database Tables",
  cicd: "CI/CD Pipelines",
  "auth-spec": "Auth Specifications",
  member: "Team Members",
  concept: "Concept Documents",
};

const TYPE_ORDER = [
  "fr",
  "nfr",
  "epic",
  "story",
  "task",
  "bug",
  "sprint",
  "release",
  "adr",
  "arch",
  "service",
  "data-proc",
  "cicd",
  "auth-spec",
  "db-table",
  "member",
  "concept",
];

function buildSpecContent(items) {
  if (items.length === 0) {
    return (
      "No project specification found.\n\n" +
      "Use the write_file tool (or the VS Code Project Spec extension) to create items.\n" +
      "Files are stored in `.spec/` at the workspace root."
    );
  }

  const groups = new Map();
  for (const item of items) {
    const g = groups.get(item.data.type) ?? [];
    g.push(item);
    groups.set(item.data.type, g);
  }

  const lines = ["# Project Specification\n"];

  for (const type of TYPE_ORDER) {
    const group = groups.get(type);
    if (!group?.length) continue;
    lines.push(`\n## ${TYPE_LABELS[type] ?? type}\n`);
    for (const item of group) {
      const d = item.data;
      lines.push(`### [${d.id}] ${d.title}`);
      lines.push(`- **File**: ${path.relative(workspaceRoot, item.filePath)}`);
      lines.push(`- **Status**: ${d.status}`);
      if (d.priority) lines.push(`- **Priority**: ${d.priority}`);
      if (d.epicId) lines.push(`- **Epic**: ${d.epicId}`);
      if (d.storyId) lines.push(`- **Story**: ${d.storyId}`);
      if (d.sprintId) lines.push(`- **Sprint**: ${d.sprintId}`);
      if (d.releaseId) lines.push(`- **Release**: ${d.releaseId}`);
      if (d.dependsOn) lines.push(`- **Depends on**: ${d.dependsOn}`);
      if (d.linkedIds) lines.push(`- **Linked**: ${d.linkedIds}`);
      if (d.assigneeId) lines.push(`- **Assigned to**: ${d.assigneeId}`);
      if (d.role) lines.push(`- **Role**: ${d.role}`);
      if (d.startDate) lines.push(`- **Start**: ${d.startDate}`);
      if (d.dueDate) lines.push(`- **Due**: ${d.dueDate}`);
      if (d.releaseDate) lines.push(`- **Release date**: ${d.releaseDate}`);
      if (d.relations) lines.push(`- **FK relations**: ${d.relations}`);
      if (item.body.trim()) lines.push(`\n${item.body.trim()}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Schema reference (ported from src/specTool.ts SPEC_SCHEMA)
// ---------------------------------------------------------------------------

const SPEC_SCHEMA = `# Project Spec — Document Schema Reference

All spec documents are Markdown files with a YAML front-matter block delimited by \`---\`.
They live inside the \`.spec/\` folder at the workspace root.

---

## TYPE REGISTRY — the only 17 valid document types

The \`type\` field in every front-matter block MUST be one of these exact lowercase strings.
No other values exist. Using anything else (e.g. \`spec\`, \`technical-spec\`, \`auth\`, \`service-spec\`, \`tech-spec\`) will cause validation to fail.

| \`type\` value | \`id\` prefix | Directory under \`.spec/\` | File name | Valid \`status\` values |
|--------------|-------------|--------------------------|-----------|------------------------|
| \`epic\`      | \`EPIC-NNN\` | \`backlog/epics/\`          | \`epic-NNN.md\` | \`draft\` · \`active\` · \`done\` |
| \`story\`     | \`US-NNN\`   | \`backlog/stories/\`        | \`us-NNN.md\`   | \`draft\` · \`active\` · \`done\` |
| \`task\`      | \`TASK-NNN\` | \`backlog/tasks/\`          | \`task-NNN.md\` | \`todo\` · \`in-progress\` · \`testing\` · \`blocked\` · \`done\` |
| \`bug\`       | \`BUG-NNN\`  | \`backlog/tasks/\`          | \`bug-NNN.md\`  | \`todo\` · \`in-progress\` · \`testing\` · \`blocked\` · \`done\` |
| \`fr\`        | \`FR-NNN\`   | \`requirements/fr/\`        | \`fr-NNN.md\`   | \`draft\` · \`active\` · \`deprecated\` |
| \`nfr\`       | \`NFR-NNN\`  | \`requirements/nfr/\`       | \`nfr-NNN.md\`  | \`draft\` · \`active\` · \`deprecated\` |
| \`sprint\`    | \`SPR-NNN\`  | \`planning/sprints/\`       | \`spr-NNN.md\`  | \`planned\` · \`active\` · \`done\` |
| \`release\`   | \`REL-NNN\`  | \`planning/releases/\`      | \`rel-NNN.md\`  | \`draft\` · \`active\` · \`released\` |
| \`adr\`       | \`ADR-NNN\`  | \`technical/adr/\`          | \`adr-NNN.md\`  | \`proposed\` · \`accepted\` · \`deprecated\` · \`superseded\` |
| \`arch\`      | \`ARCH-NNN\` | \`technical/\`              | \`arch-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`service\`   | \`SRV-NNN\`  | \`services/\`               | \`srv-NNN.md\`  | \`draft\` · \`active\` · \`deprecated\` |
| \`data-proc\` | \`DP-NNN\`   | \`technical/data-processes/\`| \`dp-NNN.md\`  | \`draft\` · \`active\` · \`deprecated\` |
| \`db-table\`  | \`TBL-NNN\`  | \`technical/database/\`     | \`tbl-NNN.md\`  | \`draft\` · \`active\` · \`done\` |
| \`cicd\`      | \`CICD-NNN\` | \`technical/cicd/\`         | \`cicd-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`auth-spec\` | \`AUTH-NNN\` | \`technical/auth/\`         | \`auth-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`member\`    | \`MBR-NNN\`  | \`team/members/\`           | \`mbr-NNN.md\`  | \`active\` · \`draft\` |
| \`concept\`   | \`CON-NNN\`  | \`concept/{section}/\`      | \`con-NNN.md\`  | \`draft\` · \`active\` · \`deprecated\` |

\`NNN\` = zero-padded 3-digit number (001, 002, …). Always call \`read_spec\` first to find the next available number.

For \`concept\`, \`{section}\` is one of: \`history\` · \`goals\` · \`principles\` · \`risks\` · \`sysdesign\` · \`sysimpl\`.
Example path: \`.spec/concept/goals/con-001.md\`

---

## Front-matter fields

### Required fields (every type)

\`\`\`yaml
id: EPIC-001          # uppercase ID — prefix from the Type Registry above
type: epic            # MUST be one of the 17 exact type strings from the Type Registry
title: "My Title"     # human-readable title — MUST be enclosed in double quotes
status: draft         # MUST be one of the valid statuses for this type (see Type Registry)
created: 2026-01-15   # ISO date YYYY-MM-DD (today's date)
\`\`\`

### Relational fields

\`\`\`yaml
epicId: EPIC-001
  # story — REQUIRED: reference to the parent epic

storyId: US-001
  # task / bug — REQUIRED: reference to the parent user story

sprintId: SPR-001
  # story / task / bug — assigns the item to a sprint

releaseId: REL-001
  # story / task / bug — assigns the item to a release

linkedIds: FR-001,US-002
  # fr / nfr — comma-separated IDs of related items (NO spaces)

dependsOn: TASK-003,TASK-004
  # any — prerequisite items that must be completed first (NO spaces)

assigneeId: MBR-001
  # task / bug — reference to the team member assigned to this item

role: frontend
  # member — REQUIRED: the team member's role (e.g. frontend, backend, designer, devops)

priority: high
  # story / task / bug / fr / nfr — high | medium | low

startDate: 2026-01-15
  # epic / story / task / bug / sprint — ISO date YYYY-MM-DD

dueDate: 2026-01-28
  # epic / story / task / bug / sprint — ISO date YYYY-MM-DD

releaseDate: 2026-06-30
  # release — the planned/actual release date (ISO date YYYY-MM-DD)

relations: userId:TBL-001,orderId:TBL-002
  # db-table — FK columns, format: columnName:referencedTableId (NO spaces)

processType: async
  # data-proc — REQUIRED: type of execution — sync | async | cron
\`\`\`

---

## Relationship graph

\`\`\`
FR / NFR  ──linkedIds──►  Epic / Story / Task
                                │
Epic  ◄──epicId──  Story  ◄──storyId──  Task / Bug
                     │                      │
                  sprintId              assigneeId
                     │                      │
                   Sprint                 Member
                     │
                  releaseId
                     │
                  Release

db-table  ──relations──►  db-table   (FK references between tables)

ADR / arch / service / cicd / auth-spec — standalone technical docs
  └─ may use dependsOn to reference tasks or other technical docs
\`\`\`

### How relations work

1. **epicId** (story → epic): Every story MUST set \`epicId\` to the ID of its parent epic.
   Example: \`epicId: EPIC-001\`

2. **storyId** (task/bug → story): Every task and bug MUST set \`storyId\` to the ID of its parent story.
   Example: \`storyId: US-003\`

3. **sprintId** / **releaseId** (story/task/bug → sprint/release): Assigns the item to a sprint or release.
   Example: \`sprintId: SPR-001\`, \`releaseId: REL-002\`

4. **linkedIds** (fr/nfr → any): Links functional/non-functional requirements to implementing items.
   Format: comma-separated IDs with NO spaces. Example: \`linkedIds: US-001,TASK-005\`

5. **dependsOn** (any → any): Declares a "must complete first" dependency.
   Format: comma-separated IDs with NO spaces. Example: \`dependsOn: TASK-002,TASK-003\`

6. **assigneeId** (task/bug → member): Assigns work to a team member.
   Example: \`assigneeId: MBR-002\`

7. **relations** (db-table → db-table): Declares foreign key relationships between database tables.
   Format: \`columnName:referencedTableId\` pairs, comma-separated.
   Example: \`relations: userId:TBL-001,productId:TBL-003\`

---

## Required body sections per type

### epic
\`\`\`markdown
## Description
Describe the goal and scope of this epic.

## Acceptance Criteria
- [ ] …

## Notes
…
\`\`\`

### story
\`\`\`markdown
## Description
As a [role], I can [action] so that [benefit].

## Acceptance Criteria
- [ ] …

## Notes
…
\`\`\`

### task
\`\`\`markdown
## Description
…

## Subtasks
- [ ] …

## Notes
…
\`\`\`

### bug
\`\`\`markdown
## Description
…

## Steps to Reproduce
1. …

## Expected Behavior
…

## Actual Behavior
…

## Notes
…
\`\`\`

### fr (Functional Requirement)
\`\`\`markdown
## Description
The system shall …

## Acceptance Criteria
- [ ] …
\`\`\`

### nfr (Non-Functional Requirement)
\`\`\`markdown
## Description
…

## Metric
- Target: …
- Measurement: …
\`\`\`

### adr (Architecture Decision Record)
\`\`\`markdown
## Context
…

## Decision
…

## Consequences
…
\`\`\`

### arch / service / cicd / auth-spec
\`\`\`markdown
## Overview
…

## Details
…
\`\`\`

### data-proc (Data Process)
\`\`\`markdown
## Overview
Describe the data process: purpose, inputs, and outputs.

## Data Flow
Input → Transformation → Output

## Steps
1. …

## Error Handling
- …
\`\`\`

### db-table
\`\`\`markdown
## Columns
| Column | Type | Description |
|--------|------|-------------|
| id     | uuid | Primary key |

## Notes
…
\`\`\`

### sprint
\`\`\`markdown
## Goal
…

## Stories
- US-NNN …
\`\`\`

### release
\`\`\`markdown
## Scope
…

## Included Stories
- US-NNN …
\`\`\`

### member
\`\`\`markdown
## Bio
Name — role description.
\`\`\`

### concept
Concept documents live in section-specific subdirectories under \`.spec/concept/\`:
- \`history\`  → History & Problem
- \`goals\`    → Goals
- \`principles\` → Core Principles
- \`risks\`    → Risks & Obstacles
- \`sysdesign\` → System Design
- \`sysimpl\`  → System Implementation

\`\`\`markdown
## [Section-appropriate heading]
…
\`\`\`

---

## Rules & constraints

1. **type is strictly enforced** — only the 17 exact strings in the Type Registry are valid. Never invent or guess a type. Specifically invalid: \`spec\`, \`technical-spec\`, \`service-spec\`, \`auth\`, \`architecture\`, \`requirement\`, \`tech-spec\`.
2. **IDs are immutable** — never change an existing \`id\` field.
3. **Comma-separated fields** (\`linkedIds\`, \`dependsOn\`, \`relations\`) must have NO spaces around commas.
4. **Dates** must be ISO format \`YYYY-MM-DD\` only.
5. **title** must always be enclosed in double quotes in the front matter.
6. **epicId** is required on every story; **storyId** is required on every task and bug.
7. **role** is required on every member.
8. Always call \`validate_file\` after writing a file to confirm it's valid.
9. Always call \`read_spec\` before creating a new item to determine the next available ID number.
`;

// ---------------------------------------------------------------------------
// Validation (ported from src/specTool.ts)
// ---------------------------------------------------------------------------

const ID_PREFIXES = {
  epic: "EPIC",
  story: "US",
  task: "TASK",
  bug: "BUG",
  fr: "FR",
  nfr: "NFR",
  adr: "ADR",
  arch: "ARCH",
  "service": "SRV",
  "data-proc": "DP",
  sprint: "SPR",
  release: "REL",
  "db-table": "TBL",
  cicd: "CICD",
  "auth-spec": "AUTH",
  member: "MBR",
  concept: "CON",
};

const VALID_STATUSES = {
  epic: ["draft", "active", "done"],
  story: ["draft", "active", "done"],
  task: ["todo", "in-progress", "testing", "blocked", "done"],
  bug: ["todo", "in-progress", "testing", "blocked", "done"],
  fr: ["draft", "active", "deprecated"],
  nfr: ["draft", "active", "deprecated"],
  adr: ["proposed", "accepted", "deprecated", "superseded"],
  arch: ["draft", "active", "deprecated"],
  "service": ["draft", "active", "deprecated"],
  "data-proc": ["draft", "active", "deprecated"],
  "db-table": ["draft", "active", "done"],
  cicd: ["draft", "active", "deprecated"],
  "auth-spec": ["draft", "active", "deprecated"],
  sprint: ["planned", "active", "done"],
  release: ["draft", "active", "released"],
  member: ["active", "draft"],
  concept: ["draft", "active", "deprecated"],
};

const ALL_TYPES = Object.keys(ID_PREFIXES);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COMMA_LIST_RE = /^[A-Z0-9-]+(,[A-Z0-9-]+)*$/;

function validateSpecFile(filePath) {
  const absPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(workspaceRoot, filePath);

  if (!fs.existsSync(absPath)) {
    return `❌ File not found: ${filePath}`;
  }

  const content = fs.readFileSync(absPath, "utf-8");
  const { data, body } = parseFrontMatter(content);
  const errors = [];
  const warnings = [];

  if (!data.id) errors.push("Missing required field: id");
  if (!data.type) errors.push("Missing required field: type");
  if (!data.title) errors.push("Missing required field: title");
  if (!data.status) errors.push("Missing required field: status");
  if (!data.created) errors.push("Missing required field: created");

  const type = data.type;
  if (type && !ALL_TYPES.includes(type)) {
    errors.push(
      `Invalid type: "${type}". Must be one of: ${ALL_TYPES.join(", ")}`,
    );
  }

  if (type && ALL_TYPES.includes(type)) {
    const expectedPrefix = ID_PREFIXES[type];
    const idPattern = new RegExp(`^${expectedPrefix}-\\d{3}$`);
    if (data.id && !idPattern.test(data.id)) {
      errors.push(
        `Invalid id: "${data.id}". For type "${type}", id must match ${expectedPrefix}-NNN (e.g. ${expectedPrefix}-001)`,
      );
    }

    const validStatuses = VALID_STATUSES[type];
    if (data.status && !validStatuses.includes(data.status)) {
      errors.push(
        `Invalid status: "${data.status}" for type "${type}". Valid values: ${validStatuses.join(", ")}`,
      );
    }

    if (type === "story" && !data.epicId) {
      errors.push(
        "Missing required field: epicId (stories must reference a parent epic)",
      );
    }
    if ((type === "task" || type === "bug") && !data.storyId) {
      errors.push(
        `Missing required field: storyId (${type}s must reference a parent story)`,
      );
    }
    if (type === "member" && !data.role) {
      errors.push("Missing required field: role (members must have a role)");
    }

    if (["story", "task", "bug"].includes(type) && !data.priority) {
      warnings.push(
        "Recommended field missing: priority (high | medium | low)",
      );
    }
    if (["task", "bug"].includes(type) && !data.assigneeId) {
      warnings.push("Recommended field missing: assigneeId");
    }
  }

  for (const [field, value] of [
    ["created", data.created],
    ["startDate", data.startDate],
    ["dueDate", data.dueDate],
    ["releaseDate", data.releaseDate],
  ]) {
    if (value && !ISO_DATE_RE.test(value)) {
      errors.push(
        `Invalid date format for "${field}": "${value}". Must be YYYY-MM-DD`,
      );
    }
  }

  for (const [field, value] of [
    ["linkedIds", data.linkedIds],
    ["dependsOn", data.dependsOn],
  ]) {
    if (value && !COMMA_LIST_RE.test(value)) {
      errors.push(
        `Invalid format for "${field}": "${value}". Must be comma-separated IDs with no spaces (e.g. US-001,US-002)`,
      );
    }
  }

  if (!body.trim()) {
    warnings.push(
      "Body is empty — add the required sections for this document type",
    );
  }

  const lines = [`## Validation report: ${path.basename(absPath)}\n`];
  if (errors.length === 0 && warnings.length === 0) {
    lines.push("✅ All checks passed — document structure is valid.");
  } else {
    if (errors.length > 0) {
      lines.push(`### ❌ Errors (${errors.length})\n`);
      for (const e of errors) lines.push(`- ${e}`);
      lines.push("");
    }
    if (warnings.length > 0) {
      lines.push(`### ⚠️ Warnings (${warnings.length})\n`);
      for (const w of warnings) lines.push(`- ${w}`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Write spec file
// ---------------------------------------------------------------------------

function writeSpecFile(filePath, content) {
  if (!filePath || !content)
    return "❌ Both filePath and content are required.";

  const specDir = path.join(workspaceRoot, ".spec");
  const absPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(workspaceRoot, filePath);
  const resolved = path.resolve(absPath);

  if (
    !resolved.startsWith(path.resolve(specDir) + path.sep) &&
    resolved !== path.resolve(specDir)
  ) {
    return `❌ Path must be inside the .spec/ directory. Got: ${filePath}`;
  }

  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(resolved, content, "utf-8");
  return `✅ File written: ${path.relative(workspaceRoot, resolved)}`;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "read_spec",
    description:
      "Read the full project specification — all items across all types with their metadata and body. " +
      "Call this first to see existing IDs before creating new items.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_schema",
    description:
      "Get the complete schema reference for Project Spec files: front-matter fields, " +
      "valid statuses per type, relationship rules, file naming conventions, and required body sections. " +
      "Call this before creating or editing any spec file.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "query",
    description:
      "Filter spec items by type and/or status. Returns only the matching items with full metadata.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description:
            "Comma-separated list of item types to filter by. " +
            "Valid types: epic, story, task, bug, fr, nfr, adr, arch, service, data-proc, db-table, cicd, auth-spec, sprint, release, member, concept.",
        },
        status: {
          type: "string",
          description:
            "Comma-separated list of statuses to filter by. " +
            'E.g. "draft,active" or "todo,in-progress,blocked".',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "write_file",
    description:
      "Create or overwrite a spec file inside the .spec/ directory. " +
      "The file must contain valid YAML front-matter followed by Markdown body. " +
      "Always call validate_file after writing to confirm the file is valid.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description:
            'Workspace-relative path to the file, e.g. ".spec/backlog/epics/epic-001.md". ' +
            "Must be inside the .spec/ directory.",
        },
        content: {
          type: "string",
          description:
            "Full file content: YAML front-matter block (--- ... ---) followed by the Markdown body.",
        },
      },
      required: ["filePath", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "validate_file",
    description:
      "Validate a spec file: checks required fields, ID format, status values, " +
      "relational field requirements (epicId, storyId, role), and date formats.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description:
            'Workspace-relative path to the spec file, e.g. ".spec/backlog/epics/epic-001.md".',
        },
      },
      required: ["filePath"],
      additionalProperties: false,
    },
  },
  {
    name: "read_file",
    description: "Read the raw content of a single spec file.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description:
            'Workspace-relative path to the spec file, e.g. ".spec/backlog/epics/epic-001.md".',
        },
      },
      required: ["filePath"],
      additionalProperties: false,
    },
  },
];

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

function callTool(name, args) {
  switch (name) {
    case "read_spec": {
      const items = readAllSpecItems();
      return buildSpecContent(items);
    }

    case "get_schema": {
      return SPEC_SCHEMA;
    }

    case "query": {
      let items = readAllSpecItems();
      if (args.type) {
        const types = args.type.split(",").map((t) => t.trim());
        items = items.filter((i) => types.includes(i.data.type));
      }
      if (args.status) {
        const statuses = args.status.split(",").map((s) => s.trim());
        items = items.filter((i) => statuses.includes(i.data.status));
      }
      return items.length === 0
        ? "No items match the given filters."
        : buildSpecContent(items);
    }

    case "write_file": {
      const { filePath, content } = args;
      return writeSpecFile(filePath, content);
    }

    case "validate_file": {
      const { filePath } = args;
      if (!filePath) return "❌ filePath is required.";
      return validateSpecFile(filePath);
    }

    case "read_file": {
      const { filePath } = args;
      if (!filePath) return "❌ filePath is required.";
      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceRoot, filePath);
      if (!fs.existsSync(absPath)) return `❌ File not found: ${filePath}`;
      return fs.readFileSync(absPath, "utf-8");
    }

    default:
      return `❌ Unknown tool: ${name}`;
  }
}

// ---------------------------------------------------------------------------
// MCP JSON-RPC 2.0 stdio transport (newline-delimited JSON)
// ---------------------------------------------------------------------------

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function handleRequest(msg) {
  const { jsonrpc, id, method, params } = msg;

  // Notifications (no id) — acknowledge silently
  if (id === undefined || id === null) {
    return; // e.g. notifications/initialized
  }

  switch (method) {
    case "initialize": {
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "project-spec",
            version: "1.0.0",
          },
        },
      });
      break;
    }

    case "tools/list": {
      send({
        jsonrpc: "2.0",
        id,
        result: { tools: TOOLS },
      });
      break;
    }

    case "tools/call": {
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};
      let resultText;
      try {
        resultText = callTool(toolName, toolArgs);
      } catch (err) {
        resultText = `❌ Error: ${err.message}`;
      }
      send({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: resultText }],
        },
      });
      break;
    }

    default: {
      send({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const msg = JSON.parse(trimmed);
    handleRequest(msg);
  } catch {
    // ignore malformed lines
  }
});

rl.on("close", () => process.exit(0));
