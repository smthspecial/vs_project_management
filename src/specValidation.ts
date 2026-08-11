import * as fs from "fs";
import * as path from "path";
import { parseFrontMatter } from "./specParser";
import { ALL_TYPES, ID_PREFIXES, VALID_STATUSES, ItemType, ItemStatus } from "./models";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COMMA_LIST_RE = /^[A-Z0-9-]+(,[A-Z0-9-]+)*$/;

/**
 * Validates a .spec markdown file's front matter and body against the
 * type registry in models.ts: required fields, id/prefix format, valid
 * statuses, type-specific relational fields, date formats, and comma-list
 * formats. Returns a human-readable Markdown report.
 */
export function validateSpecFile(filePath: string, workspaceRoot: string): string {
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
