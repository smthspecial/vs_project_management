import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { SpecTreeDataProvider, SpecTreeItem } from "./specTree";
import {
  generateId,
  buildFrontMatter,
  parseFrontMatter,
  getSpecDir,
  getTypeDir,
} from "./specParser";
import { SpecItem } from "./models";
import {
  ItemStatus,
  ItemPriority,
  SpecFrontMatter,
  EPIC_STATUSES,
  STORY_STATUSES,
  TASK_STATUSES,
  FR_NFR_STATUSES,
  ADR_STATUSES,
  TECH_STATUSES,
  SPRINT_STATUSES,
  RELEASE_STATUSES,
} from "./models";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function today(): string {
  return new Date().toISOString().split("T")[0]!;
}

async function pickPriority(): Promise<ItemPriority | undefined> {
  const pick = await vscode.window.showQuickPick(
    [
      { label: "$(arrow-up) High", value: "high" as ItemPriority },
      { label: "$(dash) Medium", value: "medium" as ItemPriority },
      { label: "$(arrow-down) Low", value: "low" as ItemPriority },
    ],
    { placeHolder: "Select priority" },
  );
  return pick?.value;
}

async function openFile(filePath: string): Promise<void> {
  const uri = vscode.Uri.file(filePath);
  await vscode.commands.executeCommand("project-spec._revealInTree", filePath);
  await vscode.window.showTextDocument(uri);
}

// ---------------------------------------------------------------------------
// Command implementations
// ---------------------------------------------------------------------------

async function requireRootPath(
  getRootPath: () => string | undefined,
): Promise<string | undefined> {
  const p = getRootPath();
  if (!p) {
    const action = await vscode.window.showErrorMessage(
      "Project Spec: open a workspace folder first.",
      "Open Folder…",
    );
    if (action === "Open Folder…") {
      await vscode.commands.executeCommand("vscode.openFolder");
    }
  }
  return p;
}

async function createEpic(
  provider: SpecTreeDataProvider,
  getRootPath: () => string | undefined,
): Promise<void> {
  const rootPath = await requireRootPath(getRootPath);
  if (!rootPath) {
    return;
  }

  const title = await vscode.window.showInputBox({
    prompt: "Epic title",
    placeHolder: "e.g. User Authentication",
    validateInput: (v) => (v.trim() ? null : "Title cannot be empty"),
  });
  if (!title) {
    return;
  }

  const id = generateId(provider.getAllItems(), "epic");
  const dir = getTypeDir(rootPath, "epic");
  ensureDir(dir);
  const filePath = path.join(dir, `${id.toLowerCase()}.md`);

  const frontMatter = buildFrontMatter({
    id,
    type: "epic",
    title: title.trim(),
    status: "draft",
    created: today(),
  });

  const body =
    `## Overview\n\nDescribe the goal and scope of this epic.\n\n` +
    `## Goals\n\n- \n\n` +
    `## Out of Scope\n\n- \n`;

  fs.writeFileSync(filePath, frontMatter + body, "utf-8");
  provider.refresh();
  await openFile(filePath);
}

async function createStory(
  provider: SpecTreeDataProvider,
  getRootPath: () => string | undefined,
  node?: SpecTreeItem,
): Promise<void> {
  const rootPath = await requireRootPath(getRootPath);
  if (!rootPath) {
    return;
  }
  const items = provider.getAllItems();
  const epicItems = items.filter((i) => i.data.type === "epic");

  if (epicItems.length === 0) {
    vscode.window.showErrorMessage("No epics found. Create an epic first.");
    return;
  }

  let epicId: string | undefined =
    node?.spec.data.type === "epic" ? node.spec.data.id : undefined;

  if (!epicId) {
    const pick = await vscode.window.showQuickPick(
      epicItems.map((i) => ({
        label: i.data.id,
        description: i.data.title,
        id: i.data.id,
      })),
      { placeHolder: "Select parent epic" },
    );
    if (!pick) {
      return;
    }
    epicId = pick.id;
  }

  const title = await vscode.window.showInputBox({
    prompt: "User story title",
    placeHolder: "e.g. As a user, I can log in with email and password",
    validateInput: (v) => (v.trim() ? null : "Title cannot be empty"),
  });
  if (!title) {
    return;
  }

  const priority = (await pickPriority()) ?? "medium";
  const id = generateId(items, "story");
  const dir = getTypeDir(rootPath, "story");
  ensureDir(dir);
  const filePath = path.join(dir, `${id.toLowerCase()}.md`);

  const frontMatter = buildFrontMatter({
    id,
    type: "story",
    title: title.trim(),
    status: "draft",
    epicId,
    priority,
    created: today(),
  });

  const body =
    `## Description\n\n${title.trim()}\n\n` +
    `## Acceptance Criteria\n\n- [ ] \n\n` +
    `## Notes\n\n`;

  fs.writeFileSync(filePath, frontMatter + body, "utf-8");
  provider.refresh();
  await openFile(filePath);
}

async function createTaskOrBug(
  itemType: "task" | "bug",
  provider: SpecTreeDataProvider,
  getRootPath: () => string | undefined,
  node?: SpecTreeItem,
): Promise<void> {
  const rootPath = await requireRootPath(getRootPath);
  if (!rootPath) {
    return;
  }
  const items = provider.getAllItems();
  const storyItems = items.filter((i) => i.data.type === "story");

  if (storyItems.length === 0) {
    vscode.window.showErrorMessage(
      "No user stories found. Create a user story first.",
    );
    return;
  }

  let storyId: string | undefined =
    node?.spec.data.type === "story" ? node.spec.data.id : undefined;

  if (!storyId) {
    const pick = await vscode.window.showQuickPick(
      storyItems.map((i) => ({
        label: i.data.id,
        description: i.data.title,
        id: i.data.id,
      })),
      { placeHolder: "Select parent user story" },
    );
    if (!pick) {
      return;
    }
    storyId = pick.id;
  }

  const label = itemType === "task" ? "Task" : "Bug";
  const placeHolder =
    itemType === "bug"
      ? "e.g. Login button not responding on Safari"
      : "e.g. Implement login form UI";

  const title = await vscode.window.showInputBox({
    prompt: `${label} title`,
    placeHolder,
    validateInput: (v) => (v.trim() ? null : "Title cannot be empty"),
  });
  if (!title) {
    return;
  }

  const priority = (await pickPriority()) ?? "medium";
  const id = generateId(items, itemType);
  const dir = getTypeDir(rootPath, itemType);
  ensureDir(dir);
  const filePath = path.join(dir, `${id.toLowerCase()}.md`);

  const frontMatter = buildFrontMatter({
    id,
    type: itemType,
    title: title.trim(),
    status: "todo",
    storyId,
    priority,
    created: today(),
  });

  const body =
    itemType === "bug"
      ? `## Description\n\n${title.trim()}\n\n` +
        `## Steps to Reproduce\n\n1. \n2. \n\n` +
        `## Expected Behavior\n\n\n\n` +
        `## Actual Behavior\n\n\n\n` +
        `## Notes\n\n`
      : `## Description\n\n${title.trim()}\n\n` +
        `## Subtasks\n\n- [ ] \n\n` +
        `## Notes\n\n`;

  fs.writeFileSync(filePath, frontMatter + body, "utf-8");
  provider.refresh();
  await openFile(filePath);
}

async function changeStatus(
  provider: SpecTreeDataProvider,
  node?: SpecTreeItem,
): Promise<void> {
  if (!node?.spec) {
    return;
  }

  const { type, status } = node.spec.data;
  const statusList: ItemStatus[] =
    type === "epic"
      ? EPIC_STATUSES
      : type === "story"
        ? STORY_STATUSES
        : type === "task" || type === "bug"
          ? TASK_STATUSES
          : type === "fr" || type === "nfr"
            ? FR_NFR_STATUSES
            : type === "adr"
              ? ADR_STATUSES
              : type === "sprint"
                ? SPRINT_STATUSES
                : type === "release"
                  ? RELEASE_STATUSES
                  : TECH_STATUSES;

  const pick = await vscode.window.showQuickPick(
    statusList.map((s) => ({
      label: s,
      description: s === status ? "(current)" : undefined,
    })),
    { placeHolder: `Current status: ${status}` },
  );
  if (!pick || pick.label === status) {
    return;
  }

  const newStatus = pick.label as ItemStatus;
  const content = fs.readFileSync(node.spec.filePath, "utf-8");
  const { data: fmData, body: fmBody } = parseFrontMatter(content);
  fmData.status = newStatus;
  const updated = buildFrontMatter(fmData as SpecFrontMatter) + fmBody;
  fs.writeFileSync(node.spec.filePath, updated, "utf-8");

  // Refresh the open editor if it's showing this file
  const openDoc = vscode.workspace.textDocuments.find(
    (d) => d.uri.fsPath === node.spec.filePath,
  );
  if (openDoc) {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      openDoc.uri,
      new vscode.Range(0, 0, openDoc.lineCount, 0),
      updated,
    );
    await vscode.workspace.applyEdit(edit);
  }

  // Re-read from disk so rollup sees the newly written status
  provider.refresh();
  const freshItems = provider.getAllItems();
  const didRollup = rollupStatus(node.spec.data, newStatus, freshItems);
  if (didRollup) {
    provider.refresh();
  }
}

async function deleteItem(
  provider: SpecTreeDataProvider,
  node?: SpecTreeItem,
): Promise<void> {
  if (!node?.spec) {
    return;
  }

  const { id, title } = node.spec.data;
  const confirm = await vscode.window.showWarningMessage(
    `Delete ${id}: "${title}"?\n\nThis action cannot be undone.`,
    { modal: true },
    "Delete",
  );
  if (confirm !== "Delete") {
    return;
  }

  fs.unlinkSync(node.spec.filePath);
  provider.refresh();
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

async function createRequirement(
  reqType: "fr" | "nfr",
  provider: SpecTreeDataProvider,
  getRootPath: () => string | undefined,
): Promise<void> {
  const rootPath = await requireRootPath(getRootPath);
  if (!rootPath) {
    return;
  }

  const label =
    reqType === "fr" ? "Functional Requirement" : "Non-Functional Requirement";
  const placeHolder =
    reqType === "fr"
      ? "e.g. The system shall allow users to log in"
      : "e.g. The system shall respond within 200ms";

  const title = await vscode.window.showInputBox({
    prompt: `${label} title`,
    placeHolder,
    validateInput: (v) => (v.trim() ? null : "Title cannot be empty"),
  });
  if (!title) {
    return;
  }

  const priority = (await pickPriority()) ?? "medium";
  const id = generateId(provider.getAllItems(), reqType);
  const dir = getTypeDir(rootPath, reqType);
  ensureDir(dir);
  const filePath = path.join(dir, `${id.toLowerCase()}.md`);

  const frontMatter = buildFrontMatter({
    id,
    type: reqType,
    title: title.trim(),
    status: "draft",
    priority,
    created: today(),
  });

  const body =
    reqType === "fr"
      ? `## Description\n\n${title.trim()}\n\n` +
        `## Acceptance Criteria\n\n- [ ] \n\n` +
        `## Linked Items\n\n` +
        `<!-- Set \`linkedIds: US-001,TASK-001\` in front matter to link stories/tasks -->\n`
      : `## Description\n\n${title.trim()}\n\n` +
        `## Metric\n\n- Target: \n- Measurement: \n\n` +
        `## Linked Items\n\n` +
        `<!-- Set \`linkedIds: US-001,TASK-001\` in front matter to link stories/tasks -->\n`;

  fs.writeFileSync(filePath, frontMatter + body, "utf-8");
  provider.refresh();
  await openFile(filePath);
}

// ---------------------------------------------------------------------------
// Technical
// ---------------------------------------------------------------------------

async function createAdr(
  provider: SpecTreeDataProvider,
  getRootPath: () => string | undefined,
): Promise<void> {
  const rootPath = await requireRootPath(getRootPath);
  if (!rootPath) {
    return;
  }

  const title = await vscode.window.showInputBox({
    prompt: "ADR title",
    placeHolder: "e.g. Use PostgreSQL as primary database",
    validateInput: (v) => (v.trim() ? null : "Title cannot be empty"),
  });
  if (!title) {
    return;
  }

  const id = generateId(provider.getAllItems(), "adr");
  const dir = getTypeDir(rootPath, "adr");
  ensureDir(dir);
  const filePath = path.join(dir, `${id.toLowerCase()}.md`);

  const frontMatter = buildFrontMatter({
    id,
    type: "adr",
    title: title.trim(),
    status: "proposed",
    created: today(),
  });

  const body =
    `## Context\n\nDescribe the context and problem statement.\n\n` +
    `## Decision\n\nDescribe the decision made.\n\n` +
    `## Consequences\n\n### Positive\n\n- \n\n### Negative\n\n- \n\n` +
    `## Alternatives Considered\n\n- \n`;

  fs.writeFileSync(filePath, frontMatter + body, "utf-8");
  provider.refresh();
  await openFile(filePath);
}

async function createArch(
  provider: SpecTreeDataProvider,
  getRootPath: () => string | undefined,
): Promise<void> {
  const rootPath = await requireRootPath(getRootPath);
  if (!rootPath) {
    return;
  }

  const title = await vscode.window.showInputBox({
    prompt: "Architecture document title",
    placeHolder: "e.g. System Overview, Database Design, API Gateway",
    validateInput: (v) => (v.trim() ? null : "Title cannot be empty"),
  });
  if (!title) {
    return;
  }

  const id = generateId(provider.getAllItems(), "arch");
  const dir = getTypeDir(rootPath, "arch");
  ensureDir(dir);
  const filePath = path.join(dir, `${id.toLowerCase()}.md`);

  const frontMatter = buildFrontMatter({
    id,
    type: "arch",
    title: title.trim(),
    status: "draft",
    created: today(),
  });

  const body =
    `## Overview\n\nDescribe this architectural component.\n\n` +
    `## Diagram\n\n\`\`\`\n<!-- Add diagram here -->\n\`\`\`\n\n` +
    `## Components\n\n- \n\n` +
    `## Interfaces\n\n- \n`;

  fs.writeFileSync(filePath, frontMatter + body, "utf-8");
  provider.refresh();
  await openFile(filePath);
}

async function createTechSpec(
  provider: SpecTreeDataProvider,
  getRootPath: () => string | undefined,
): Promise<void> {
  const rootPath = await requireRootPath(getRootPath);
  if (!rootPath) {
    return;
  }

  const title = await vscode.window.showInputBox({
    prompt: "Technical specification title",
    placeHolder: "e.g. Authentication Service, Payment API",
    validateInput: (v) => (v.trim() ? null : "Title cannot be empty"),
  });
  if (!title) {
    return;
  }

  const id = generateId(provider.getAllItems(), "tech-spec");
  const dir = getTypeDir(rootPath, "tech-spec");
  ensureDir(dir);
  const filePath = path.join(dir, `${id.toLowerCase()}.md`);

  const frontMatter = buildFrontMatter({
    id,
    type: "tech-spec",
    title: title.trim(),
    status: "draft",
    created: today(),
  });

  const body =
    `## Overview\n\nDescribe this technical component.\n\n` +
    `## API / Interface\n\n\`\`\`\n<!-- Define the API/interface -->\n\`\`\`\n\n` +
    `## Data Model\n\n- \n\n` +
    `## Dependencies\n\n- \n\n` +
    `## Error Handling\n\n- \n`;

  fs.writeFileSync(filePath, frontMatter + body, "utf-8");
  provider.refresh();
  await openFile(filePath);
}

// ---------------------------------------------------------------------------
// Sprints
// ---------------------------------------------------------------------------

async function createSprint(
  provider: SpecTreeDataProvider,
  getRootPath: () => string | undefined,
): Promise<void> {
  const rootPath = await requireRootPath(getRootPath);
  if (!rootPath) {
    return;
  }

  const title = await vscode.window.showInputBox({
    prompt: "Sprint title",
    placeHolder: "e.g. Sprint 1 - Authentication",
    validateInput: (v) => (v.trim() ? null : "Title cannot be empty"),
  });
  if (!title) {
    return;
  }

  const startDate = await vscode.window.showInputBox({
    prompt: "Sprint start date (YYYY-MM-DD)",
    placeHolder: new Date().toISOString().split("T")[0],
    validateInput: (v) =>
      /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? null : "Use format YYYY-MM-DD",
  });
  if (!startDate) {
    return;
  }

  const dueDate = await vscode.window.showInputBox({
    prompt: "Sprint end date (YYYY-MM-DD)",
    placeHolder: "",
    validateInput: (v) =>
      /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? null : "Use format YYYY-MM-DD",
  });
  if (!dueDate) {
    return;
  }

  const items = provider.getAllItems();
  const id = generateId(items, "sprint");
  const dir = getTypeDir(rootPath, "sprint");
  ensureDir(dir);
  const filePath = path.join(dir, `${id.toLowerCase()}.md`);

  const frontMatter = buildFrontMatter({
    id,
    type: "sprint",
    title: title.trim(),
    status: "planned",
    startDate: startDate.trim(),
    dueDate: dueDate.trim(),
    created: today(),
  });

  const body =
    `## Goal\n\n${title.trim()}\n\n` +
    `## Stories\n\n<!-- Stories assigned to this sprint will appear here -->\n`;

  fs.writeFileSync(filePath, frontMatter + body, "utf-8");
  provider.refresh();
  await openFile(filePath);
}

// ---------------------------------------------------------------------------
// Releases
// ---------------------------------------------------------------------------

async function createRelease(
  provider: SpecTreeDataProvider,
  getRootPath: () => string | undefined,
): Promise<void> {
  const rootPath = await requireRootPath(getRootPath);
  if (!rootPath) {
    return;
  }

  const title = await vscode.window.showInputBox({
    prompt: "Release title",
    placeHolder: "e.g. v1.0.0 - Initial Release",
    validateInput: (v) => (v.trim() ? null : "Title cannot be empty"),
  });
  if (!title) {
    return;
  }

  const releaseDate = await vscode.window.showInputBox({
    prompt: "Release date (YYYY-MM-DD)",
    placeHolder: "",
    validateInput: (v) =>
      /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? null : "Use format YYYY-MM-DD",
  });
  if (!releaseDate) {
    return;
  }

  const items = provider.getAllItems();
  const id = generateId(items, "release");
  const dir = getTypeDir(rootPath, "release");
  ensureDir(dir);
  const filePath = path.join(dir, `${id.toLowerCase()}.md`);

  const frontMatter = buildFrontMatter({
    id,
    type: "release",
    title: title.trim(),
    status: "draft",
    releaseDate: releaseDate.trim(),
    created: today(),
  });

  const body =
    `## Overview\n\n${title.trim()}\n\n` +
    `## What's Included\n\n<!-- Stories and tasks in this release -->\n\n` +
    `## Release Notes\n\n- \n`;

  fs.writeFileSync(filePath, frontMatter + body, "utf-8");
  provider.refresh();
  await openFile(filePath);
}

// ---------------------------------------------------------------------------
// Add to Sprint / Release
// ---------------------------------------------------------------------------

async function addToSprint(
  provider: SpecTreeDataProvider,
  node?: SpecTreeItem,
): Promise<void> {
  if (!node?.spec) {
    return;
  }

  const items = provider.getAllItems();
  const sprintItems = items.filter((i) => i.data.type === "sprint");

  if (sprintItems.length === 0) {
    vscode.window.showErrorMessage("No sprints found. Create a sprint first.");
    return;
  }

  const pick = await vscode.window.showQuickPick(
    [
      { label: "(none)", description: "Remove sprint assignment", id: "" },
      ...sprintItems.map((i) => ({
        label: i.data.id,
        description: i.data.title,
        id: i.data.id,
      })),
    ],
    { placeHolder: "Assign to sprint (or select none to unlink)" },
  );
  if (pick === undefined) {
    return;
  }

  const content = fs.readFileSync(node.spec.filePath, "utf-8");
  const { data, body } = parseFrontMatter(content);
  if (!data.id) {
    return;
  }
  if (pick.id) {
    data.sprintId = pick.id;
  } else {
    delete data.sprintId;
  }
  const newFm = buildFrontMatter(data as SpecFrontMatter);
  fs.writeFileSync(node.spec.filePath, newFm + body, "utf-8");
  provider.refresh();
}

async function addToRelease(
  provider: SpecTreeDataProvider,
  node?: SpecTreeItem,
): Promise<void> {
  if (!node?.spec) {
    return;
  }

  const items = provider.getAllItems();
  const releaseItems = items.filter((i) => i.data.type === "release");

  if (releaseItems.length === 0) {
    vscode.window.showErrorMessage(
      "No releases found. Create a release first.",
    );
    return;
  }

  const pick = await vscode.window.showQuickPick(
    [
      { label: "(none)", description: "Remove release assignment", id: "" },
      ...releaseItems.map((i) => ({
        label: i.data.id,
        description: i.data.title,
        id: i.data.id,
      })),
    ],
    { placeHolder: "Assign to release (or select none to unlink)" },
  );
  if (pick === undefined) {
    return;
  }

  const content = fs.readFileSync(node.spec.filePath, "utf-8");
  const { data, body } = parseFrontMatter(content);
  if (!data.id) {
    return;
  }
  if (pick.id) {
    data.releaseId = pick.id;
  } else {
    delete data.releaseId;
  }
  const newFm = buildFrontMatter(data as SpecFrontMatter);
  fs.writeFileSync(node.spec.filePath, newFm + body, "utf-8");
  provider.refresh();
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

async function addDependency(
  provider: SpecTreeDataProvider,
  node?: SpecTreeItem,
): Promise<void> {
  if (!node?.spec) {
    return;
  }

  const items = provider.getAllItems();
  const candidates = items.filter((i) => i.data.id !== node.spec.data.id);

  if (candidates.length === 0) {
    vscode.window.showInformationMessage("No other items to depend on.");
    return;
  }

  const currentDeps = node.spec.data.dependsOn
    ? node.spec.data.dependsOn
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const picks = await vscode.window.showQuickPick(
    candidates.map((i) => ({
      label: i.data.id,
      description: i.data.title,
      picked: currentDeps.includes(i.data.id),
    })),
    {
      placeHolder:
        "Select items this item depends on (must be completed first)",
      canPickMany: true,
    },
  );

  if (!picks) {
    return;
  }

  const newDeps = picks.map((p) => p.label).join(",");
  const content = fs.readFileSync(node.spec.filePath, "utf-8");
  const { data: depData, body: depBody } = parseFrontMatter(content);
  if (newDeps) {
    depData.dependsOn = newDeps;
  } else {
    delete depData.dependsOn;
  }
  fs.writeFileSync(
    node.spec.filePath,
    buildFrontMatter(depData as SpecFrontMatter) + depBody,
    "utf-8",
  );
  provider.refresh();
}

// ---------------------------------------------------------------------------
// Database tables
// ---------------------------------------------------------------------------

async function createTable(
  provider: SpecTreeDataProvider,
  getRootPath: () => string | undefined,
): Promise<void> {
  const rootPath = await requireRootPath(getRootPath);
  if (!rootPath) {
    return;
  }

  const title = await vscode.window.showInputBox({
    prompt: "Table name (snake_case)",
    placeHolder: "e.g. order_items",
    validateInput: (v) => (v.trim() ? null : "Table name cannot be empty"),
  });
  if (!title) {
    return;
  }

  const id = generateId(provider.getAllItems(), "db-table");
  const dir = getTypeDir(rootPath, "db-table");
  ensureDir(dir);
  const slug = id.toLowerCase().replace("-", "");
  const filePath = path.join(dir, `${slug}.md`);

  const frontMatter = buildFrontMatter({
    id,
    type: "db-table",
    title: title.trim(),
    status: "active" as ItemStatus,
    created: today(),
  });

  const body =
    `## Description\n\n${title.trim()} table.\n\n` +
    `## Columns\n\n` +
    `| Column | Type | Constraints |\n` +
    `|--------|------|-------------|\n` +
    `| id | uuid | PK |\n`;

  fs.writeFileSync(filePath, frontMatter + body, "utf-8");
  provider.refresh();
  await openFile(filePath);
}

// ---------------------------------------------------------------------------
// Sprint / Release contents
// ---------------------------------------------------------------------------

interface ContentsQuickPickItem extends vscode.QuickPickItem {
  filePath?: string;
}

export async function showContents(
  id: string,
  kind: "sprint" | "release" | "epic" | "story",
  items: SpecItem[],
): Promise<void> {
  // --- epic: show stories with their children ---
  if (kind === "epic") {
    const stories = items
      .filter((i) => i.data.type === "story" && i.data.epicId === id)
      .sort((a, b) => a.data.id.localeCompare(b.data.id));
    const epicTasks = items.filter(
      (i) =>
        (i.data.type === "task" || i.data.type === "bug") &&
        stories.some((s) => s.data.id === i.data.storyId),
    );
    if (stories.length === 0) {
      vscode.window.showInformationMessage(`No stories found for epic ${id}.`);
      return;
    }
    const quickItems: ContentsQuickPickItem[] = [];
    for (const story of stories) {
      const children = epicTasks
        .filter((t) => t.data.storyId === story.data.id)
        .sort((a, b) => a.data.id.localeCompare(b.data.id));
      quickItems.push({
        kind: vscode.QuickPickItemKind.Separator,
        label: `$(person) ${story.data.id} \u2014 ${story.data.title}  [${story.data.status}]`,
      });
      quickItems.push({
        label: `$(file-text) Open user story`,
        description: story.data.status,
        detail: story.data.id,
        filePath: story.filePath,
      });
      for (const child of children) {
        const icon = child.data.type === "bug" ? "$(bug)" : "$(checklist)";
        quickItems.push({
          label: `${icon} ${child.data.id} \u2014 ${child.data.title}`,
          description: child.data.status,
          filePath: child.filePath,
        });
      }
    }
    const picked = await vscode.window.showQuickPick(quickItems, {
      placeHolder: `Stories in epic ${id} \u2014 select to open file`,
      matchOnDescription: true,
      matchOnDetail: true,
    });
    if (picked?.filePath) {
      await vscode.window.showTextDocument(vscode.Uri.file(picked.filePath));
    }
    return;
  }

  // --- story: show tasks and bugs ---
  if (kind === "story") {
    const children = items
      .filter(
        (i) =>
          (i.data.type === "task" || i.data.type === "bug") &&
          i.data.storyId === id,
      )
      .sort((a, b) => a.data.id.localeCompare(b.data.id));
    if (children.length === 0) {
      vscode.window.showInformationMessage(
        `No tasks or bugs found for story ${id}.`,
      );
      return;
    }
    const quickItems: ContentsQuickPickItem[] = children.map((c) => {
      const icon = c.data.type === "bug" ? "$(bug)" : "$(checklist)";
      return {
        label: `${icon} ${c.data.id} \u2014 ${c.data.title}`,
        description: c.data.status,
        filePath: c.filePath,
      };
    });
    const picked = await vscode.window.showQuickPick(quickItems, {
      placeHolder: `Tasks & bugs for story ${id} \u2014 select to open file`,
      matchOnDescription: true,
    });
    if (picked?.filePath) {
      await vscode.window.showTextDocument(vscode.Uri.file(picked.filePath));
    }
    return;
  }

  // --- sprint / release ---
  const stories = items.filter(
    (i) =>
      i.data.type === "story" &&
      (kind === "sprint" ? i.data.sprintId === id : i.data.releaseId === id),
  );
  const allTasks = items.filter(
    (i) =>
      (i.data.type === "task" || i.data.type === "bug") &&
      (kind === "sprint" ? i.data.sprintId === id : i.data.releaseId === id),
  );

  if (stories.length === 0 && allTasks.length === 0) {
    vscode.window.showInformationMessage(`No stories found for ${id}.`);
    return;
  }

  const quickItems: ContentsQuickPickItem[] = [];

  for (const story of stories.sort((a, b) =>
    a.data.id.localeCompare(b.data.id),
  )) {
    const children = allTasks
      .filter((t) => t.data.storyId === story.data.id)
      .sort((a, b) => a.data.id.localeCompare(b.data.id));

    quickItems.push({
      kind: vscode.QuickPickItemKind.Separator,
      label: `$(person) ${story.data.id} — ${story.data.title}  [${story.data.status}]`,
    });
    quickItems.push({
      label: `$(file-text) Open user story`,
      description: story.data.status,
      detail: story.data.id,
      filePath: story.filePath,
    });
    for (const child of children) {
      const icon = child.data.type === "bug" ? "$(bug)" : "$(checklist)";
      quickItems.push({
        label: `${icon} ${child.data.id} — ${child.data.title}`,
        description: child.data.status,
        filePath: child.filePath,
      });
    }
  }

  const orphanTasks = allTasks.filter(
    (t) => !stories.some((s) => s.data.id === t.data.storyId),
  );
  if (orphanTasks.length > 0) {
    quickItems.push({
      kind: vscode.QuickPickItemKind.Separator,
      label: "Unlinked tasks",
    });
    for (const t of orphanTasks) {
      const icon = t.data.type === "bug" ? "$(bug)" : "$(checklist)";
      quickItems.push({
        label: `${icon} ${t.data.id} — ${t.data.title}`,
        description: t.data.status,
        filePath: t.filePath,
      });
    }
  }

  const picked = await vscode.window.showQuickPick(quickItems, {
    placeHolder: `Contents of ${id} — select to open file`,
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (picked?.filePath) {
    await vscode.window.showTextDocument(vscode.Uri.file(picked.filePath));
  }
}

// ---------------------------------------------------------------------------
// Status rollup helpers
// ---------------------------------------------------------------------------

function writeStatusToFile(filePath: string, newStatus: ItemStatus): void {
  const content = fs.readFileSync(filePath, "utf-8");
  const { data, body } = parseFrontMatter(content);
  data.status = newStatus;
  fs.writeFileSync(
    filePath,
    buildFrontMatter(data as SpecFrontMatter) + body,
    "utf-8",
  );
}

function rollupStatus(
  data: { type: string; storyId?: string; epicId?: string; id: string },
  newStatus: ItemStatus,
  freshItems: SpecItem[],
): boolean {
  let changed = false;

  // task/bug → parent story
  if (
    (data.type === "task" || data.type === "bug") &&
    data.storyId &&
    newStatus === "done"
  ) {
    const siblings = freshItems.filter(
      (i) =>
        (i.data.type === "task" || i.data.type === "bug") &&
        i.data.storyId === data.storyId,
    );
    if (
      siblings.length > 0 &&
      siblings.every((i) => i.data.status === "done")
    ) {
      const story = freshItems.find(
        (i) => i.data.type === "story" && i.data.id === data.storyId,
      );
      if (story && story.data.status !== "done") {
        writeStatusToFile(story.filePath, "done");
        changed = true;
        // chain: check if story's epic should also roll up
        if (story.data.epicId) {
          changed =
            checkEpicRollup(story.data.epicId, story.data.id, freshItems) ||
            changed;
        }
      }
    }
  }

  // story → parent epic
  if (data.type === "story" && data.epicId && newStatus === "done") {
    changed = checkEpicRollup(data.epicId, data.id, freshItems) || changed;
  }

  return changed;
}

function checkEpicRollup(
  epicId: string,
  justDoneStoryId: string,
  freshItems: SpecItem[],
): boolean {
  const siblings = freshItems.filter(
    (i) => i.data.type === "story" && i.data.epicId === epicId,
  );
  if (siblings.length === 0) {
    return false;
  }
  const allDone = siblings.every(
    (i) => i.data.status === "done" || i.data.id === justDoneStoryId,
  );
  if (!allDone) {
    return false;
  }
  const epic = freshItems.find(
    (i) => i.data.type === "epic" && i.data.id === epicId,
  );
  if (!epic || epic.data.status === "done") {
    return false;
  }
  writeStatusToFile(epic.filePath, "done");
  return true;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerCommands(
  context: vscode.ExtensionContext,
  provider: SpecTreeDataProvider,
  getRootPath: () => string | undefined,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("project-spec.refresh", () =>
      provider.refresh(),
    ),

    vscode.commands.registerCommand(
      "project-spec.openFile",
      (filePath: string) => openFile(filePath),
    ),

    vscode.commands.registerCommand("project-spec.newEpic", () =>
      createEpic(provider, getRootPath),
    ),

    vscode.commands.registerCommand(
      "project-spec.newStory",
      (node?: SpecTreeItem) => createStory(provider, getRootPath, node),
    ),

    vscode.commands.registerCommand(
      "project-spec.newTask",
      (node?: SpecTreeItem) =>
        createTaskOrBug("task", provider, getRootPath, node),
    ),

    vscode.commands.registerCommand(
      "project-spec.newBug",
      (node?: SpecTreeItem) =>
        createTaskOrBug("bug", provider, getRootPath, node),
    ),

    vscode.commands.registerCommand(
      "project-spec.changeStatus",
      (node?: SpecTreeItem) => changeStatus(provider, node),
    ),

    vscode.commands.registerCommand(
      "project-spec.deleteItem",
      (node?: SpecTreeItem) => deleteItem(provider, node),
    ),

    vscode.commands.registerCommand("project-spec.newFr", () =>
      createRequirement("fr", provider, getRootPath),
    ),

    vscode.commands.registerCommand("project-spec.newNfr", () =>
      createRequirement("nfr", provider, getRootPath),
    ),

    vscode.commands.registerCommand("project-spec.newAdr", () =>
      createAdr(provider, getRootPath),
    ),

    vscode.commands.registerCommand("project-spec.newArch", () =>
      createArch(provider, getRootPath),
    ),

    vscode.commands.registerCommand("project-spec.newTechSpec", () =>
      createTechSpec(provider, getRootPath),
    ),

    vscode.commands.registerCommand(
      "project-spec.addDependency",
      (node?: SpecTreeItem) => addDependency(provider, node),
    ),

    vscode.commands.registerCommand("project-spec.newSprint", () =>
      createSprint(provider, getRootPath),
    ),

    vscode.commands.registerCommand("project-spec.newRelease", () =>
      createRelease(provider, getRootPath),
    ),

    vscode.commands.registerCommand(
      "project-spec.addToSprint",
      (node?: SpecTreeItem) => addToSprint(provider, node),
    ),

    vscode.commands.registerCommand(
      "project-spec.addToRelease",
      (node?: SpecTreeItem) => addToRelease(provider, node),
    ),

    vscode.commands.registerCommand("project-spec.newTable", () =>
      createTable(provider, getRootPath),
    ),

    vscode.commands.registerCommand(
      "project-spec.showContents",
      (id: string, kind: "sprint" | "release") =>
        showContents(id, kind, provider.getAllItems()),
    ),
  );
}
