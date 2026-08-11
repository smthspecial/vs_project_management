import * as vscode from "vscode";
import { writeSpecFile } from "../specParser";
import { buildSpecContent, buildQueryContent } from "../specContent";
import { validateSpecFile } from "../specValidation";
import type { SpecTreeDataProvider } from "../specTree";
import type { ItemType } from "../models";
import { TYPE_REGISTRY_TABLE, KEY_RULES } from "./typeRegistry";
import {
  BODY_TEMPLATES,
  memberBodyTemplate,
  CONCEPT_SECTION_META,
} from "../specBodyTemplates";

// ---------------------------------------------------------------------------
// Spec schema — instructions for AI when creating or editing spec files.
//
// Assembled from logical parts rather than one hand-typed blob:
//   1. TYPE_REGISTRY_TABLE / KEY_RULES  — shared with the Copilot/Claude/
//      Codex instruction files (./typeRegistry.ts)
//   2. FRONT_MATTER_FIELDS_DOC          — front-matter field reference
//   3. renderBodySectionsDoc()          — generated from specBodyTemplates.ts,
//      the same templates the "New X" commands actually write to disk
//   4. DB_TABLE_RELATIONS_GUIDE         — FK/relations modeling guidance
//   5. SCHEMA_RULES                     — numbered authoring rules
// Change a fact in exactly one place and every part that quotes it — this
// doc, the generated instruction files, and the actual file-creation
// commands — stays correct.
// ---------------------------------------------------------------------------

const FRONT_MATTER_FIELDS_DOC = `\
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
\`\`\``;

// Display heading for each type's body-section block. Types not listed here
// use their bare type string as the heading.
const BODY_SECTION_HEADINGS: Partial<Record<ItemType, string>> = {
  fr: "fr (Functional Requirement)",
  nfr: "nfr (Non-Functional Requirement)",
  adr: "adr (Architecture Decision Record)",
  arch: "arch (Architecture Doc)",
  service: "service (Service)",
  "data-proc": "data-proc (Data Process)",
  "db-table": "db-table (Database Table)",
  "auth-spec": "auth-spec (Auth Specification)",
};

// Display order for the generated body-sections doc.
const BODY_SECTION_ORDER: ItemType[] = [
  "epic",
  "story",
  "task",
  "bug",
  "fr",
  "nfr",
  "sprint",
  "release",
  "adr",
  "arch",
  "service",
  "data-proc",
  "db-table",
  "cicd",
  "auth-spec",
];

const EXAMPLE_TITLE = "…";

function renderBodySectionsDoc(): string {
  const blocks = BODY_SECTION_ORDER.map((type) => {
    const template = BODY_TEMPLATES[type];
    if (!template) {
      return "";
    }
    const heading = BODY_SECTION_HEADINGS[type] ?? type;
    return `### ${heading}\n\`\`\`markdown\n${template(EXAMPLE_TITLE).trimEnd()}\n\`\`\``;
  });

  blocks.push(
    `### member\n\`\`\`markdown\n${memberBodyTemplate("Jane Doe", "frontend").trimEnd()}\n\`\`\``,
  );

  const conceptSections = Object.entries(CONCEPT_SECTION_META)
    .map(
      ([section, meta]) =>
        `#### \`${section}\` — ${meta.label}\n\`\`\`markdown\n${meta.body.trimEnd()}\n\`\`\``,
    )
    .join("\n\n");
  blocks.push(
    `### concept\nConcept documents live in section-specific subdirectories under \`.spec/concept/\`, each with its own body template:\n\n${conceptSections}`,
  );

  return blocks.join("\n\n");
}

const DB_TABLE_RELATIONS_GUIDE = `\
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
- Every FK column should appear in both the \`## Columns\` table and in \`relations\` front matter.
- Describe the ON DELETE behaviour (CASCADE / SET NULL / RESTRICT) in prose near the column, since the starter template doesn't include a dedicated Relations section.
- For many-to-many relationships, always create an explicit junction table — do NOT embed arrays in a column.`;

const SCHEMA_RULES = `\
${KEY_RULES}
- New files must be validated with \`project-spec_validate-file\` before considering them complete.
- Call \`project-spec_get-schema\` before creating any file — it returns this full reference.`;

const SPEC_SCHEMA = `# Project Spec — Document Schema Reference

All spec documents are Markdown files with a YAML front-matter block delimited by \`---\`.
They live inside the \`.spec/\` folder at the workspace root.

---

## TYPE REGISTRY — the only 17 valid document types

The \`type\` field in every front-matter block MUST be one of these exact lowercase strings.
No other values exist. Using anything else (e.g. \`spec\`, \`technical-spec\`, \`auth\`, \`service-spec\`) will cause validation to fail.

${TYPE_REGISTRY_TABLE}

Always call \`project-spec_read-spec\` first to find the next available number.

---

## Front-matter fields

${FRONT_MATTER_FIELDS_DOC}

---

## Required body sections per type

${renderBodySectionsDoc()}

### Database table relations in depth

${DB_TABLE_RELATIONS_GUIDE}

---

## Rules & constraints

${SCHEMA_RULES}
`;

// ---------------------------------------------------------------------------
// Tool input shapes — the vscode.lm contract each tool receives
// ---------------------------------------------------------------------------

interface ValidateInput {
  filePath: string;
}

interface QueryInput {
  type?: string;
  status?: string;
}

interface WriteFileInput {
  filePath: string;
  content: string;
}

function currentWorkspaceRoot(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
}

// ---------------------------------------------------------------------------
// Register the language model tools — thin adapters over the spec-domain
// functions in ../specContent, ../specValidation, and ../specParser.
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
        const filePath = input?.filePath ?? "";
        if (!filePath) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
              "❌ No filePath provided. Pass the workspace-relative path to the spec file.",
            ),
          ]);
        }
        const report = validateSpecFile(filePath, currentWorkspaceRoot());
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
        const { filePath, content } = input ?? {};
        if (!filePath || !content) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
              "❌ Both filePath and content are required.",
            ),
          ]);
        }
        const result = writeSpecFile(filePath, content, currentWorkspaceRoot());
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
