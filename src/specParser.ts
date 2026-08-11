import * as fs from "fs";
import * as path from "path";
import {
  ItemType,
  ItemStatus,
  ItemPriority,
  SpecFrontMatter,
  SpecItem,
  ID_PREFIXES,
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
    sprintId: raw["sprintId"],
    releaseId: raw["releaseId"],
    startDate: raw["startDate"],
    dueDate: raw["dueDate"],
    releaseDate: raw["releaseDate"],
    relations: raw["relations"],
    priority: raw["priority"] as ItemPriority | undefined,
    assigneeId: raw["assigneeId"],
    role: raw["role"],
    processType: raw["processType"] as "sync" | "async" | "cron" | undefined,
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
  if (data.sprintId) {
    lines.push(`sprintId: ${data.sprintId}`);
  }
  if (data.releaseId) {
    lines.push(`releaseId: ${data.releaseId}`);
  }
  if (data.startDate) {
    lines.push(`startDate: ${data.startDate}`);
  }
  if (data.dueDate) {
    lines.push(`dueDate: ${data.dueDate}`);
  }
  if (data.releaseDate) {
    lines.push(`releaseDate: ${data.releaseDate}`);
  }
  if (data.relations) {
    lines.push(`relations: ${data.relations}`);
  }
  if (data.priority) {
    lines.push(`priority: ${data.priority}`);
  }
  if (data.assigneeId) {
    lines.push(`assigneeId: ${data.assigneeId}`);
  }
  if (data.role) {
    lines.push(`role: ${data.role}`);
  }
  if (data.processType) {
    lines.push(`processType: ${data.processType}`);
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
    epic: "backlog/epics",
    story: "backlog/stories",
    task: "backlog/tasks",
    bug: "backlog/tasks",
    adr: "technical/adr",
    arch: "technical/arch",
    "data-proc": "technical/data-processes",
    "service": "technical/services",
    "db-table": "technical/database",
    sprint: "planning/sprints",
    release: "planning/releases",
    member: "team/members",
    cicd: "technical/cicd",
    "auth-spec": "technical/auth",
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
    "backlog/epics",
    "backlog/stories",
    "backlog/tasks",
    "planning/sprints",
    "planning/releases",
    "technical/adr",
    "technical/arch",
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
// Writing — used by both the "New X" UI commands (which build their own
// content) and the AI write-file tool (which receives finished content)
// ---------------------------------------------------------------------------

/**
 * Writes `content` to `filePath`, refusing to write outside `.spec/`.
 * `filePath` may be workspace-relative or absolute.
 */
export function writeSpecFile(
  filePath: string,
  content: string,
  workspaceRoot: string,
): string {
  const specDir = getSpecDir(workspaceRoot);
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
// ID generation
// ---------------------------------------------------------------------------

export function generateId(items: SpecItem[], type: ItemType): string {
  const prefix = ID_PREFIXES[type];

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
