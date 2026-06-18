import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { parseFrontMatter } from "./specParser";
import type { SpecTreeDataProvider } from "./specTree";
import type { ItemType, ItemStatus, SpecItem } from "./models";

// ---------------------------------------------------------------------------
// Type labels for display
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
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
  member: "Team Members",
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
  "db-table",
  "member",
];

// ---------------------------------------------------------------------------
// Build a Markdown summary of all spec items
// ---------------------------------------------------------------------------

function buildSpecContent(items: SpecItem[]): string {
  if (items.length === 0) {
    return (
      "No project specification found.\n\n" +
      "Open the Project Spec sidebar and use the + buttons to create items.\n" +
      "Files are stored in `.spec/` at the workspace root."
    );
  }

  const groups = new Map<string, SpecItem[]>();
  for (const item of items) {
    const g = groups.get(item.data.type) ?? [];
    g.push(item);
    groups.set(item.data.type, g);
  }

  const lines: string[] = ["# Project Specification\n"];

  for (const type of TYPE_ORDER) {
    const group = groups.get(type);
    if (!group?.length) {
      continue;
    }

    lines.push(`\n## ${TYPE_LABELS[type] ?? type}\n`);

    for (const item of group) {
      const d = item.data;
      lines.push(`### [${d.id}] ${d.title}`);
      lines.push(`- **Status**: ${d.status}`);
      if (d.priority) {
        lines.push(`- **Priority**: ${d.priority}`);
      }
      if (d.epicId) {
        lines.push(`- **Epic**: ${d.epicId}`);
      }
      if (d.storyId) {
        lines.push(`- **Story**: ${d.storyId}`);
      }
      if (d.sprintId) {
        lines.push(`- **Sprint**: ${d.sprintId}`);
      }
      if (d.releaseId) {
        lines.push(`- **Release**: ${d.releaseId}`);
      }
      if (d.dependsOn) {
        lines.push(`- **Depends on**: ${d.dependsOn}`);
      }
      if (d.startDate) {
        lines.push(`- **Start**: ${d.startDate}`);
      }
      if (d.dueDate) {
        lines.push(`- **Due**: ${d.dueDate}`);
      }
      if (d.releaseDate) {
        lines.push(`- **Release date**: ${d.releaseDate}`);
      }
      if (d.assigneeId) {
        lines.push(`- **Assigned to**: ${d.assigneeId}`);
      }
      if (d.role) {
        lines.push(`- **Role**: ${d.role}`);
      }
      if (d.processType) {
        lines.push(`- **Process type**: ${d.processType}`);
      }
      if (item.body.trim()) {
        lines.push(`\n${item.body.trim()}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Spec schema — instructions for AI when creating / editing spec files
// ---------------------------------------------------------------------------

const SPEC_SCHEMA = `# Project Spec — Document Schema Reference

All spec documents are Markdown files with a YAML front-matter block delimited by \`---\`.
They live inside the \`.spec/\` folder at the workspace root.

---

## TYPE REGISTRY — the only 17 valid document types

The \`type\` field in every front-matter block MUST be one of these exact lowercase strings.
No other values exist. Using anything else (e.g. \`spec\`, \`technical-spec\`, \`auth\`, \`service-spec\`) will cause validation to fail.

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
| \`service\`   | \`SRV-NNN\`  | \`services/\`               | \`srv-NNN.md\`   | \`draft\` · \`active\` · \`deprecated\` |
| \`data-proc\` | \`DP-NNN\`   | \`technical/data-processes/\`| \`dp-NNN.md\`   | \`draft\` · \`active\` · \`deprecated\` |
| \`db-table\`  | \`TBL-NNN\`  | \`technical/database/\`     | \`tbl-NNN.md\`  | \`draft\` · \`active\` · \`done\` |
| \`cicd\`      | \`CICD-NNN\` | \`technical/cicd/\`         | \`cicd-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`auth-spec\` | \`AUTH-NNN\` | \`technical/auth/\`         | \`auth-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`member\`    | \`MBR-NNN\`  | \`team/members/\`           | \`mbr-NNN.md\`  | \`active\` · \`draft\` |
| \`concept\`   | \`CON-NNN\`  | \`concept/{section}/\`      | \`con-NNN.md\`  | \`draft\` · \`active\` · \`deprecated\` |

\`NNN\` = zero-padded 3-digit number (001, 002, …). Always call \`project-spec_read-spec\` first to find the next available number.

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
created: 2026-01-15   # ISO date YYYY-MM-DD (today)
\`\`\`

### Relational fields

\`\`\`yaml
epicId: EPIC-001      # story — REQUIRED: reference to the parent epic
storyId: US-001       # task / bug — REQUIRED: reference to the parent user story
sprintId: SPR-001     # story / task / bug — assigns the item to a sprint
releaseId: REL-001    # story / task / bug — assigns the item to a release
linkedIds: FR-001,US-002   # fr / nfr — comma-separated linked item IDs (NO spaces)
dependsOn: TASK-003,TASK-004   # any — prerequisite items (NO spaces around commas)
assigneeId: MBR-001   # task / bug — team member assigned to this item
role: frontend        # member — REQUIRED: role (e.g. frontend, backend, designer, devops)
priority: high        # story / task / bug / fr / nfr — high | medium | low
startDate: 2026-01-15 # epic / story / task / bug / sprint — ISO date YYYY-MM-DD
dueDate: 2026-01-28   # epic / story / task / bug / sprint — ISO date YYYY-MM-DD
releaseDate: 2026-06-30   # release — planned/actual release date (ISO date YYYY-MM-DD)
relations: userId:TBL-001,orderId:TBL-002   # db-table — FK columns (NO spaces)
processType: async                          # data-proc — sync | async | cron
\`\`\`

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

## Linked Items
<!-- linkedIds set in front matter -->
\`\`\`

### nfr (Non-Functional Requirement)
\`\`\`markdown
## Description
…

## Metric
- Target: …
- Measurement: …

## Linked Items
<!-- linkedIds set in front matter -->
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
## Overview
…

## What's Included
- …

## Release Notes
- …
\`\`\`

### adr (Architecture Decision Record)
\`\`\`markdown
## Context
…

## Decision
…

## Consequences
### Positive
- …
### Negative
- …

## Alternatives Considered
- Option — reason rejected
\`\`\`

### arch (Architecture Doc)
\`\`\`markdown
## Overview
…

## Diagram
\`\`\`
ASCII or Mermaid diagram
\`\`\`

## Components
- **Name** — description

## Interfaces
- …
\`\`\`

### service (Service)
\`\`\`markdown
## Overview
…

## API / Interface
\`\`\`
HTTP routes or signatures
\`\`\`

## Implementation Notes
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

### db-table (Database Table)
\`\`\`markdown
## Columns
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id     | uuid | PK, NOT NULL | Primary key |

## Relations
- userId → TBL-001 (users) — many-to-one — FK, ON DELETE CASCADE
- orderId → TBL-005 (orders) — many-to-one — FK, ON DELETE SET NULL
\`\`\`

**Front-matter \`relations\` field** — encodes every FK column this table owns as
\`colName:TBL-NNN\` pairs, comma-separated, **no spaces**:

\`\`\`yaml
relations: userId:TBL-001,orderId:TBL-005
\`\`\`

**Relation types and how to model them**

| Relationship | How to implement |
|---|---|
| One-to-Many (1:N) | Add a FK column (e.g. \`userId uuid FK\`) on the "many" side. Set \`relations: userId:TBL-NNN\` on that table. The "one" side (e.g. users) needs no FK. |
| Many-to-Many (N:M) | Create a **junction table** (e.g. \`order_items\`). Add FK columns for both sides (e.g. \`orderId\` + \`productId\`). Set \`relations: orderId:TBL-A,productId:TBL-B\` on the junction table. |
| One-to-One (1:1) | Add a FK column with a UNIQUE constraint on one side. Set \`relations: profileId:TBL-NNN\` on that table. |
| Self-referential | FK column points to the same table (e.g. \`parentId uuid FK → this table\`). Set \`relations: parentId:TBL-NNN\` where NNN is this table's own ID. |

**Rules**
- Every FK column must appear in both the \`## Columns\` table (marked \`FK\` in Constraints) and in \`relations\` front matter.
- Always describe the ON DELETE behaviour in the \`## Relations\` body section (CASCADE / SET NULL / RESTRICT).
- For many-to-many relationships, always create an explicit junction table — do NOT embed arrays in a column.
- The \`## Relations\` body section is for human-readable documentation; the \`relations\` front-matter field is for machine-readable linking between table documents.

### cicd
\`\`\`markdown
## Overview
…

## Steps
1. …

## Configuration
…
\`\`\`

### auth-spec (Auth Specification)
\`\`\`markdown
## Overview
…

## Flows
…

## Security Considerations
…
\`\`\`

### member
\`\`\`markdown
## Bio
Name — role description.
\`\`\`

### concept
Concept documents live in section-specific subdirectories under \`.spec/concept/\`:
- \`history\`    → History & Problem
- \`goals\`      → Goals
- \`principles\` → Core Principles
- \`risks\`      → Risks & Obstacles
- \`sysdesign\`  → System Design
- \`sysimpl\`    → System Implementation

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
8. New files must be validated with \`project-spec_validate-file\` before considering them complete.
`;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ID_PREFIXES: Record<ItemType, string> = {
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

const VALID_STATUSES: Record<ItemType, ItemStatus[]> = {
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

const ALL_TYPES: ItemType[] = [
  "epic",
  "story",
  "task",
  "bug",
  "fr",
  "nfr",
  "adr",
  "arch",
  "service",
  "data-proc",
  "db-table",
  "cicd",
  "auth-spec",
  "sprint",
  "release",
  "member",
  "concept",
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COMMA_LIST_RE = /^[A-Z0-9-]+(,[A-Z0-9-]+)*$/;

interface ValidateInput {
  filePath: string;
}

function validateSpecFile(filePath: string, workspaceRoot: string): string {
  const absPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(workspaceRoot, filePath);

  if (!fs.existsSync(absPath)) {
    return `❌ File not found: ${filePath}`;
  }

  const content = fs.readFileSync(absPath, "utf-8");
  const { data, body } = parseFrontMatter(content);
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- Required common fields ---
  if (!data.id) {
    errors.push("Missing required field: id");
  }
  if (!data.type) {
    errors.push("Missing required field: type");
  }
  if (!data.title) {
    errors.push("Missing required field: title");
  }
  if (!data.status) {
    errors.push("Missing required field: status");
  }
  if (!data.created) {
    errors.push("Missing required field: created");
  }

  // --- type must be a known value ---
  const type = data.type as ItemType | undefined;
  if (data.type && !ALL_TYPES.includes(data.type as ItemType)) {
    errors.push(
      `Invalid type: "${data.type}". Must be one of: ${ALL_TYPES.join(", ")}`,
    );
  }

  if (type && ALL_TYPES.includes(type)) {
    // --- id prefix ---
    const expectedPrefix = ID_PREFIXES[type];
    const idPattern = new RegExp(`^${expectedPrefix}-\\d{3}$`);
    if (data.id && !idPattern.test(data.id)) {
      errors.push(
        `Invalid id: "${data.id}". For type "${type}", id must match ${expectedPrefix}-NNN (e.g. ${expectedPrefix}-001)`,
      );
    }

    // --- status ---
    const validStatuses = VALID_STATUSES[type];
    if (data.status && !validStatuses.includes(data.status as ItemStatus)) {
      errors.push(
        `Invalid status: "${data.status}" for type "${type}". Valid values: ${validStatuses.join(", ")}`,
      );
    }

    // --- type-specific required relational fields ---
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
    if (type === "data-proc") {
      if (!data.processType) {
        errors.push(
          "Missing required field: processType (data-proc must have sync | async | cron)",
        );
      } else if (!["sync", "async", "cron"].includes(data.processType)) {
        errors.push(
          `Invalid processType: "${data.processType}". Must be sync | async | cron`,
        );
      }
    }

    // --- type-specific optional field warnings ---
    if (
      (type === "story" || type === "task" || type === "bug") &&
      !data.priority
    ) {
      warnings.push(
        "Recommended field missing: priority (high | medium | low)",
      );
    }
    if ((type === "task" || type === "bug") && !data.assigneeId) {
      warnings.push("Recommended field missing: assigneeId");
    }
  }

  // --- date format checks ---
  for (const [field, value] of [
    ["created", data.created],
    ["startDate", data.startDate],
    ["dueDate", data.dueDate],
    ["releaseDate", data.releaseDate],
  ] as [string, string | undefined][]) {
    if (value && !ISO_DATE_RE.test(value)) {
      errors.push(
        `Invalid date format for "${field}": "${value}". Must be YYYY-MM-DD`,
      );
    }
  }

  // --- comma-separated field format checks ---
  for (const [field, value] of [
    ["linkedIds", data.linkedIds],
    ["dependsOn", data.dependsOn],
  ] as [string, string | undefined][]) {
    if (value && !COMMA_LIST_RE.test(value)) {
      errors.push(
        `Invalid format for "${field}": "${value}". Must be comma-separated IDs with no spaces (e.g. US-001,US-002)`,
      );
    }
  }

  // --- body not empty ---
  if (!body.trim()) {
    warnings.push(
      "Body is empty — add the required sections for this document type",
    );
  }

  // --- build report ---
  const lines: string[] = [`## Validation report: ${path.basename(absPath)}\n`];
  if (errors.length === 0 && warnings.length === 0) {
    lines.push("✅ All checks passed — document structure is valid.");
  } else {
    if (errors.length > 0) {
      lines.push(`### ❌ Errors (${errors.length})\n`);
      for (const e of errors) {
        lines.push(`- ${e}`);
      }
      lines.push("");
    }
    if (warnings.length > 0) {
      lines.push(`### ⚠️ Warnings (${warnings.length})\n`);
      for (const w of warnings) {
        lines.push(`- ${w}`);
      }
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Query — filter items by type and/or status
// ---------------------------------------------------------------------------

interface QueryInput {
  type?: string;
  status?: string;
}

function buildQueryContent(items: SpecItem[], input: QueryInput): string {
  let filtered = items;
  if (input.type) {
    const types = input.type.split(",").map((t) => t.trim());
    filtered = filtered.filter((i) => types.includes(i.data.type));
  }
  if (input.status) {
    const statuses = input.status.split(",").map((s) => s.trim());
    filtered = filtered.filter((i) => statuses.includes(i.data.status));
  }
  if (filtered.length === 0) {
    return "No items match the given filters.";
  }
  return buildSpecContent(filtered);
}

// ---------------------------------------------------------------------------
// Write spec file
// ---------------------------------------------------------------------------

interface WriteFileInput {
  filePath: string;
  content: string;
}

function writeSpecFile(input: WriteFileInput, workspaceRoot: string): string {
  const { filePath, content } = input;
  if (!filePath || !content) {
    return "❌ Both filePath and content are required.";
  }

  // Ensure the path stays inside .spec/ to prevent writing outside the spec directory
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
// Register the language model tool
// ---------------------------------------------------------------------------

export function registerSpecTool(
  context: vscode.ExtensionContext,
  provider: SpecTreeDataProvider,
): void {
  context.subscriptions.push(
    vscode.lm.registerTool("project-spec_read-spec", {
      invoke(_options, _token) {
        const content = buildSpecContent(provider.getAllItems());
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(content),
        ]);
      },
    }),
  );

  // Schema / instructions tool
  context.subscriptions.push(
    vscode.lm.registerTool("project-spec_get-schema", {
      invoke(_options, _token) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(SPEC_SCHEMA),
        ]);
      },
    }),
  );

  // Validation tool
  context.subscriptions.push(
    vscode.lm.registerTool("project-spec_validate-file", {
      invoke(options, _token) {
        const input = options.input as ValidateInput;
        const workspaceRoot =
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
        const filePath = input?.filePath ?? "";
        if (!filePath) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
              "❌ No filePath provided. Pass the workspace-relative path to the spec file.",
            ),
          ]);
        }
        const report = validateSpecFile(filePath, workspaceRoot);
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(report),
        ]);
      },
    }),
  );

  // Query tool
  context.subscriptions.push(
    vscode.lm.registerTool("project-spec_query", {
      invoke(options, _token) {
        const input = options.input as QueryInput;
        const result = buildQueryContent(provider.getAllItems(), input ?? {});
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(result),
        ]);
      },
    }),
  );

  // Write file tool
  context.subscriptions.push(
    vscode.lm.registerTool("project-spec_write-file", {
      invoke(options, _token) {
        const input = options.input as WriteFileInput;
        const workspaceRoot =
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
        const result = writeSpecFile(input ?? {}, workspaceRoot);
        if (result.startsWith("✅")) {
          provider.refresh();
        }
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(result),
        ]);
      },
    }),
  );
}
