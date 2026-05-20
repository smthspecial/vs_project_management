import * as fs from "fs";
import * as path from "path";
import {
  ItemType,
  ItemStatus,
  ItemPriority,
  SpecFrontMatter,
  SpecItem,
} from "./models";

// ---------------------------------------------------------------------------
// YAML front-matter parser
// ---------------------------------------------------------------------------

/**
 * Parses the YAML front-matter block from a markdown file.
 * Handles the `---\n...\n---\n` format only (no inline YAML).
 */
export function parseFrontMatter(content: string): {
  data: Partial<SpecFrontMatter>;
  body: string;
} {
  const match = content.match(
    /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/,
  );
  if (!match) {
    return { data: {}, body: content };
  }

  const yamlBlock = match[1];
  const body = match[2] ?? "";
  const raw: Record<string, string> = {};

  for (const line of yamlBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx <= 0) {
      continue;
    }
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed
      .slice(colonIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    raw[key] = value;
  }

  const data: Partial<SpecFrontMatter> = {
    id: raw["id"],
    type: raw["type"] as ItemType | undefined,
    title: raw["title"],
    status: (raw["status"] ?? "draft") as ItemStatus,
    created: raw["created"],
    epicId: raw["epicId"],
    storyId: raw["storyId"],
    linkedIds: raw["linkedIds"],
    dependsOn: raw["dependsOn"],
    startDate: raw["startDate"],
    dueDate: raw["dueDate"],
    priority: raw["priority"] as ItemPriority | undefined,
  };

  return { data, body };
}

// ---------------------------------------------------------------------------
// Front-matter serialiser
// ---------------------------------------------------------------------------

export function buildFrontMatter(data: SpecFrontMatter): string {
  const lines: string[] = ["---"];
  lines.push(`id: ${data.id}`);
  lines.push(`type: ${data.type}`);
  // Escape double-quotes inside title
  lines.push(`title: "${data.title.replace(/"/g, '\\"')}"`);
  lines.push(`status: ${data.status}`);
  if (data.epicId) {
    lines.push(`epicId: ${data.epicId}`);
  }
  if (data.storyId) {
    lines.push(`storyId: ${data.storyId}`);
  }
  if (data.linkedIds) {
    lines.push(`linkedIds: ${data.linkedIds}`);
  }
  if (data.dependsOn) {
    lines.push(`dependsOn: ${data.dependsOn}`);
  }
  if (data.startDate) {
    lines.push(`startDate: ${data.startDate}`);
  }
  if (data.dueDate) {
    lines.push(`dueDate: ${data.dueDate}`);
  }
  if (data.priority) {
    lines.push(`priority: ${data.priority}`);
  }
  lines.push(`created: ${data.created}`);
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// File / directory helpers
// ---------------------------------------------------------------------------

export function getSpecDir(rootPath: string): string {
  return path.join(rootPath, ".spec");
}

export function getTypeDir(rootPath: string, type: ItemType): string {
  const subdirMap: Partial<Record<ItemType, string>> = {
    fr: "requirements/fr",
    nfr: "requirements/nfr",
    epic: "planning/epics",
    story: "planning/stories",
    task: "planning/tasks",
    bug: "planning/tasks",
    adr: "technical/adr",
    arch: "technical/architecture",
    "tech-spec": "technical/specs",
  };
  return path.join(getSpecDir(rootPath), subdirMap[type] ?? type);
}

export function parseSpecFile(filePath: string): SpecItem | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const { data, body } = parseFrontMatter(content);
    if (!data.id || !data.type || !data.title) {
      return null;
    }
    return {
      filePath,
      data: data as SpecFrontMatter,
      body,
    };
  } catch {
    return null;
  }
}

export function readAllSpecItems(rootPath: string): SpecItem[] {
  const specDir = getSpecDir(rootPath);
  if (!fs.existsSync(specDir)) {
    return [];
  }

  const items: SpecItem[] = [];
  for (const subdir of [
    "requirements/fr",
    "requirements/nfr",
    "planning/epics",
    "planning/stories",
    "planning/tasks",
    "technical/adr",
    "technical/architecture",
    "technical/specs",
  ]) {
    const dirPath = path.join(specDir, subdir);
    if (!fs.existsSync(dirPath)) {
      continue;
    }
    for (const file of fs.readdirSync(dirPath)) {
      if (!file.endsWith(".md")) {
        continue;
      }
      const item = parseSpecFile(path.join(dirPath, file));
      if (item) {
        items.push(item);
      }
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

export function generateId(items: SpecItem[], type: ItemType): string {
  const prefix =
    type === "epic"
      ? "EPIC"
      : type === "story"
        ? "US"
        : type === "task"
          ? "TASK"
          : type === "bug"
            ? "BUG"
            : type === "fr"
              ? "FR"
              : type === "nfr"
                ? "NFR"
                : type === "adr"
                  ? "ADR"
                  : type === "arch"
                    ? "ARCH"
                    : "SPEC";

  const existing = items
    .filter((i) => i.data.type === type)
    .map((i) => {
      const parts = i.data.id.split("-");
      return parseInt(parts[parts.length - 1] ?? "0", 10);
    })
    .filter((n) => !isNaN(n));

  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}
