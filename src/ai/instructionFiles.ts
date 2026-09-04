import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { TYPE_REGISTRY_TABLE, KEY_RULES } from "./typeRegistry";

// ── Copilot instructions generator ──────────────────────────────────────────
// Written to .github/instructions/project-spec.instructions.md, scoped to
// .spec/** via the `applyTo` frontmatter VS Code Copilot Chat reads for path-
// specific instructions. Deliberately NOT written to the single repo-wide
// .github/copilot-instructions.md — that file belongs to the project, and a
// project using this extension may already have (or want) its own.

const COPILOT_INSTRUCTIONS = `\
---
applyTo: ".spec/**"
---

# Project Spec — AI Agent Instructions

This workspace uses the **Project Spec** VS Code extension. All project documentation lives in the \`.spec/\` folder as YAML front-matter markdown files.

## Available language model tools

| Tool | Purpose |
|------|---------|
| \`project-spec_get-schema\` | Front-matter fields, directory, and body template for a type — call before creating or editing any file |
| \`project-spec_read-spec\` | Read all spec items across every type |
| \`project-spec_query\` | Filter spec items by \`type\` and/or \`status\` |
| \`project-spec_write-file\` | Create or overwrite a \`.spec/\` markdown file |
| \`project-spec_validate-file\` | Validate a spec file — always run this after \`write-file\` |

## Creating or editing an item

1. \`project-spec_read-spec\` or \`project-spec_query\` to check for duplicates and find the next available ID number.
2. \`project-spec_get-schema\` for the front-matter fields, directory, and ID convention.
3. \`project-spec_write-file\` at the workspace-relative path (e.g. \`.spec/backlog/epics/epic-004.md\`).
4. \`project-spec_validate-file\` to confirm it's valid.

## TYPE REGISTRY — the only 18 valid document types

${TYPE_REGISTRY_TABLE}

## Key rules

${KEY_RULES}
`;

export function writeCopilotInstructions(rootPath: string, force: boolean): void {
  const instructionsDir = path.join(rootPath, ".github", "instructions");
  const filePath = path.join(instructionsDir, "project-spec.instructions.md");

  if (!force && fs.existsSync(filePath)) {
    return;
  }

  try {
    if (!fs.existsSync(instructionsDir)) {
      fs.mkdirSync(instructionsDir, { recursive: true });
    }
    fs.writeFileSync(filePath, COPILOT_INSTRUCTIONS, "utf8");
  } catch {
    // Best-effort — don't crash activation if the write fails
  }
}

// ── Claude Code Skill generator ─────────────────────────────────────────────
// Written to .claude/skills/project-spec/SKILL.md so the workflow below shows
// up as a discoverable Skill in Claude Code, instead of living only in prose
// instructions. This is the one Claude Code integration point — it covers
// both quick lookups and bulk authoring, so no separate subagent is needed.

const CLAUDE_SKILL = `\
---
name: project-spec
description: Use whenever this workspace's .spec/ folder is involved — answering questions about requirements, epics, stories, tasks, bugs, sprints, releases, ADRs, architecture, services, database tables, CI/CD, auth specs, team members, or product concept docs, and before creating or editing any file under .spec/. Also use for "find", "search", "what do we have on", or "is there a spec for" style questions.
---

# Project Spec

All project documentation lives in \`.spec/\` as YAML front-matter Markdown files. There's no special tool or server for reading or writing them — use your normal file tools directly, following the schema below.

## Finding existing spec content

Before creating a new item, check whether one already exists: \`Grep\` for keywords across \`.spec/**/*.md\`, or \`Glob\` a specific type's directory (e.g. \`.spec/backlog/epics/*.md\`) when you already know the type. Check \`linkedIds\` / \`dependsOn\` / \`epicId\` / \`storyId\` front matter to trace relationships between items.

## Creating or editing a spec item

1. Check the type registry below for the front-matter fields, directory, file name, and valid statuses.
2. List existing files of that type (e.g. \`ls .spec/backlog/epics/\`) to find the next available sequential number and check for duplicates.
3. Write the file directly at its workspace-relative path, e.g. \`.spec/backlog/epics/epic-004.md\`.
4. Re-read what you wrote and check it against Key Rules below — there's no separate validation tool, so this pass is on you.

This applies whether you're creating one item or a whole batch (e.g. an epic with its stories and tasks) — repeat steps 1–4 per file.

## Type registry — the only 18 valid document types

${TYPE_REGISTRY_TABLE}

## Key rules

${KEY_RULES}
`;

export function writeClaudeSkill(rootPath: string, force: boolean): void {
  const skillDir = path.join(rootPath, ".claude", "skills", "project-spec");
  const filePath = path.join(skillDir, "SKILL.md");

  if (!force && fs.existsSync(filePath)) {
    return;
  }

  try {
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }
    fs.writeFileSync(filePath, CLAUDE_SKILL, "utf8");
  } catch {
    // Best-effort — don't crash activation if the write fails
  }
}

// ── Codex / generic-agent AGENTS.md generator ───────────────────────────────
// Written to .spec/AGENTS.md, NOT the workspace root. AGENTS.md is a nested,
// "closest file wins" convention — a file at .spec/AGENTS.md governs only
// work inside .spec/ and is invisible outside it, so it can't shadow or
// conflict with a project-wide AGENTS.md the project already has at its root.

const CODEX_AGENTS_MD = `\
# Project Spec — Agent Instructions

All project documentation lives in the \`.spec/\` folder as YAML front-matter Markdown files, managed by the **Project Spec** VS Code extension. There's no special tool or server for reading or writing them — use your normal file tools directly, following the schema below.

## Creating or editing an item

1. Find the type's front-matter fields, directory, file name, and valid statuses in the type registry below.
2. Search the \`.spec/\` directory for existing items of that type to find the next available ID and check for duplicates.
3. Write the file at its workspace-relative path, e.g. \`.spec/backlog/epics/epic-004.md\`, matching the front-matter and body conventions of existing files of that type.
4. Check the front matter against the rules below by hand before considering it done — there's no separate validation tool.

## TYPE REGISTRY — the only 18 valid document types

${TYPE_REGISTRY_TABLE}

## Key rules

${KEY_RULES}
`;

export function writeCodexInstructions(rootPath: string, force: boolean): void {
  const specDir = path.join(rootPath, ".spec");
  const filePath = path.join(specDir, "AGENTS.md");

  if (!force && fs.existsSync(filePath)) {
    return;
  }

  try {
    if (!fs.existsSync(specDir)) {
      fs.mkdirSync(specDir, { recursive: true });
    }
    fs.writeFileSync(filePath, CODEX_AGENTS_MD, "utf8");
  } catch {
    // Best-effort — don't crash activation if the write fails
  }
}

// ── Command palette entry to force-regenerate all three files above ────────

export function registerInstructionFileCommands(
  context: vscode.ExtensionContext,
  getRootPath: () => string | undefined,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("project-spec.initAiInstructions", () => {
      const rp = getRootPath();
      if (!rp) {
        vscode.window.showWarningMessage(
          "Project Spec: no workspace folder open.",
        );
        return;
      }
      writeCopilotInstructions(rp, /* force */ true);
      writeClaudeSkill(rp, /* force */ true);
      writeCodexInstructions(rp, /* force */ true);
      vscode.window.showInformationMessage(
        "Project Spec: regenerated .github/instructions/project-spec.instructions.md, .claude/skills/project-spec/SKILL.md, and .spec/AGENTS.md.",
      );
    }),
  );
}

// ── Auto-write on activation — fills in any file missing from a workspace
// that already has .spec/, without ever overwriting one that already exists.

export function autoWriteInstructionFiles(rootPath: string | undefined): void {
  if (!rootPath) {
    return;
  }
  const specDir = path.join(rootPath, ".spec");
  if (!fs.existsSync(specDir)) {
    return;
  }
  writeCopilotInstructions(rootPath, /* force */ false);
  writeClaudeSkill(rootPath, /* force */ false);
  writeCodexInstructions(rootPath, /* force */ false);
}
