import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  SpecTreeDataProvider,
  SectionTreeAdapter,
  AnyTreeItem,
} from "./specTree";
import { registerCommands } from "./commands";
import { SpecCodeLensProvider } from "./codeLens";
import { SpecDefinitionProvider } from "./definitionProvider";
import { PlanningPanel, patchFrontMatter } from "./panels";
import { registerSpecTool } from "./specTool";
import { registerHoverProvider } from "./hoverProvider";
import { SyncTreeDataProvider } from "./syncTree";
import {
  fetchRemote,
  stageAndCommitSpec,
  pushBranch,
  pullBranch,
  getRemoteUrl,
  buildPrUrl,
} from "./gitSync";

export function activate(context: vscode.ExtensionContext): void {
  const getRootPath = (): string | undefined =>
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  // Use a placeholder root; provider handles missing workspace gracefully
  const rootPath = getRootPath() ?? "";
  const provider = new SpecTreeDataProvider(rootPath);

  // Register one side panel per section
  const sectionDefs: { viewId: string; section: string }[] = [
    { viewId: "projectSpecRequirementsTree", section: "requirements" },
    { viewId: "projectSpecBacklogTree", section: "backlog" },
    { viewId: "projectSpecSprintsTree", section: "sprints-releases" },
    { viewId: "projectSpecTechnicalTree", section: "technical" },
    { viewId: "projectSpecDatabaseTree", section: "database" },
    { viewId: "projectSpecTeamTree", section: "team" },
    { viewId: "projectSpecConceptTree", section: "concept" },
  ];

  const adapters: SectionTreeAdapter[] = sectionDefs.map(
    ({ section }) => new SectionTreeAdapter(provider, section),
  );

  const treeViews = new Map<string, vscode.TreeView<AnyTreeItem>>();

  sectionDefs.forEach(({ viewId }, i) => {
    const adapter = adapters[i]!;
    const treeView = vscode.window.createTreeView(viewId, {
      treeDataProvider: adapter,
      showCollapseAll: true,
    });
    treeViews.set(viewId, treeView);
    context.subscriptions.push(treeView);
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "project-spec._revealInTree",
      async (filePath: string) => {
        const viewId = provider.findViewIdForFilePath(filePath);
        const treeItem = provider.findTreeItemForFilePath(filePath);
        const treeView = viewId ? treeViews.get(viewId) : undefined;
        if (!treeView || !treeItem) {
          return;
        }
        try {
          await treeView.reveal(treeItem, {
            select: true,
            focus: false,
            expand: true,
          });
        } catch {
          // item may not be visible yet — ignore
        }
      },
    ),
  );

  // When data changes, refresh all section panels
  context.subscriptions.push(
    provider.onDidChangeTreeData(() => {
      adapters.forEach((a) => a.fire());
    }),
  );

  // Commands — always register so they work from the command palette
  registerCommands(context, provider, getRootPath);

  // Register Copilot / AI language model tool
  registerSpecTool(context, provider);

  // Sync context key and planning panel whenever tree data changes
  const syncState = (): void => {
    const items = provider.getAllItems();
    const hasSrs = items.some((i) => i.data.type === "epic");
    vscode.commands.executeCommand("setContext", "projectSpec.hasEpic", hasSrs);
    PlanningPanel.update(items);
  };

  // Open Planning panel commands (view-specific)
  const makeOpenHandler = (view: string) => () => {
    PlanningPanel.createOrShow(
      context,
      provider.getAllItems(),
      (filePath, patch) => {
        patchFrontMatter(filePath, patch);
        provider.refresh();
      },
      (filePath) => {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          vscode.window.showErrorMessage(
            `Failed to delete file: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
        provider.refresh();
      },
      view,
    );
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "project-spec.openBoard",
      makeOpenHandler("board"),
    ),
    vscode.commands.registerCommand(
      "project-spec.openTimeline",
      makeOpenHandler("timeline"),
    ),
    vscode.commands.registerCommand(
      "project-spec.openDatabase",
      makeOpenHandler("database"),
    ),
  );

  context.subscriptions.push(provider.onDidChangeTreeData(() => syncState()));
  syncState();

  // CodeLens for .spec/**/*.md files
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: "markdown", pattern: "**/.spec/**/*.md" },
      new SpecCodeLensProvider(() => provider.getAllItems()),
    ),
  );

  // Ctrl+click navigation for item IDs (EPIC-001, US-003, etc.)
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { language: "markdown", pattern: "**/.spec/**/*.md" },
      new SpecDefinitionProvider(() => provider.getAllItems()),
    ),
  );

  // Hover docs for front-matter field keys
  registerHoverProvider(context, () => provider.getAllItems());

  // Watch .spec/ folder and refresh tree on any change
  if (rootPath) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(rootPath, ".spec/**/*.md"),
    );
    watcher.onDidCreate(() => provider.refresh());
    watcher.onDidChange(() => provider.refresh());
    watcher.onDidDelete(() => provider.refresh());
    context.subscriptions.push(watcher);
  }

  // Re-init if a folder is added after activation
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      const newRoot = getRootPath();
      if (newRoot) {
        provider.setRootPath(newRoot);
        syncProvider.setRootPath(newRoot);
        void doSyncRefresh();
      }
    }),
  );

  // ── Git sync panel ───────────────────────────────────────────────────────

  const syncProvider = new SyncTreeDataProvider();
  if (rootPath) {
    syncProvider.setRootPath(rootPath);
  }

  const syncView = vscode.window.createTreeView("projectSpecSyncTree", {
    treeDataProvider: syncProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(syncView);

  // Status bar item
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    90,
  );
  statusBar.command = "project-spec.syncRefresh";
  statusBar.tooltip = "Project Spec: Git sync status (click to refresh)";
  context.subscriptions.push(statusBar);

  function updateStatusBar(): void {
    const s = syncProvider.getRemoteStatus();
    if (!s.hasRemote || s.branch === "unknown") {
      statusBar.hide();
      return;
    }
    let text = `$(git-branch) ${s.branch}`;
    if (s.ahead > 0) {
      text += ` ↑${s.ahead}`;
    }
    if (s.behind > 0) {
      text += ` ↓${s.behind}`;
    }
    if (s.behind > 0) {
      statusBar.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground",
      );
    } else {
      statusBar.backgroundColor = undefined;
    }
    statusBar.text = text;
    statusBar.show();
  }

  let notifiedBehind = false;
  let syncFetchInFlight = false;

  async function doSyncRefresh(): Promise<void> {
    await syncProvider.refresh();
    updateStatusBar();
    const s = syncProvider.getRemoteStatus();
    if (s.behind > 0 && !notifiedBehind) {
      notifiedBehind = true;
      const action = await vscode.window.showInformationMessage(
        `Project Spec: your branch is ${s.behind} commit(s) behind remote. Pull to get the latest spec changes.`,
        "Pull Now",
      );
      if (action === "Pull Now") {
        vscode.commands.executeCommand("project-spec.syncPull");
      }
    } else if (s.behind === 0) {
      notifiedBehind = false;
    }
  }

  // Initial fetch + refresh on activation
  if (rootPath) {
    void fetchRemote(rootPath).then(() => doSyncRefresh());
  }

  // Auto-fetch every 5 minutes (guarded against overlapping runs)
  const autoFetchInterval = setInterval(
    () => {
      if (syncFetchInFlight) {
        return;
      }
      const rp = getRootPath();
      if (rp) {
        syncFetchInFlight = true;
        void fetchRemote(rp)
          .then(() => doSyncRefresh())
          .finally(() => {
            syncFetchInFlight = false;
          });
      }
    },
    5 * 60 * 1_000,
  );
  context.subscriptions.push({
    dispose: () => clearInterval(autoFetchInterval),
  });

  // Refresh sync status whenever a .spec/ file is saved
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.uri.fsPath.includes(`${path.sep}.spec${path.sep}`)) {
        void syncProvider.refresh().then(updateStatusBar);
      }
    }),
  );

  // Sync commands
  context.subscriptions.push(
    vscode.commands.registerCommand("project-spec.syncRefresh", async () => {
      const rp = getRootPath();
      if (rp) {
        await fetchRemote(rp);
      }
      await doSyncRefresh();
    }),

    vscode.commands.registerCommand("project-spec.syncCommit", async () => {
      const rp = getRootPath();
      if (!rp) {
        return;
      }
      const changed = syncProvider.getChangedFiles();
      if (changed.length === 0) {
        vscode.window.showInformationMessage("No spec changes to commit.");
        return;
      }
      const message = await vscode.window.showInputBox({
        prompt: "Commit message",
        placeHolder: "feat: update project specification",
        validateInput: (v) =>
          v.trim() ? undefined : "Commit message is required",
      });
      if (!message) {
        return;
      }
      try {
        await stageAndCommitSpec(rp, message.trim());
        await doSyncRefresh();
        vscode.window.showInformationMessage(
          `Committed ${changed.length} spec file(s).`,
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `Commit failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),

    vscode.commands.registerCommand("project-spec.syncPush", async () => {
      const rp = getRootPath();
      if (!rp) {
        return;
      }
      try {
        await pushBranch(rp);
        await doSyncRefresh();
        vscode.window.showInformationMessage("Branch pushed to remote.");
      } catch (err) {
        vscode.window.showErrorMessage(
          `Push failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),

    vscode.commands.registerCommand("project-spec.syncPull", async () => {
      const rp = getRootPath();
      if (!rp) {
        return;
      }
      try {
        await pullBranch(rp);
        await doSyncRefresh();
        provider.refresh(); // spec files may have changed
        vscode.window.showInformationMessage("Pulled latest changes.");
      } catch (err) {
        vscode.window.showErrorMessage(
          `Pull failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),

    vscode.commands.registerCommand("project-spec.syncOpenPR", async () => {
      const rp = getRootPath();
      if (!rp) {
        return;
      }
      const status = syncProvider.getRemoteStatus();
      const remoteUrl = await getRemoteUrl(rp);
      const prUrl = remoteUrl
        ? buildPrUrl(remoteUrl, status.branch)
        : undefined;
      if (prUrl) {
        vscode.env.openExternal(vscode.Uri.parse(prUrl));
      } else {
        vscode.window.showInformationMessage(
          `Open a pull request for branch "${status.branch}" on your Git host.`,
        );
      }
    }),

    vscode.commands.registerCommand(
      "project-spec.initCopilotInstructions",
      async () => {
        const rp = getRootPath();
        if (!rp) {
          vscode.window.showWarningMessage(
            "Project Spec: no workspace folder open.",
          );
          return;
        }
        writeCopilotInstructions(rp, /* force */ true);
        vscode.window.showInformationMessage(
          "Project Spec: .github/copilot-instructions.md updated.",
        );
      },
    ),
  );

  // Auto-write copilot instructions if .spec/ exists and the file is absent
  if (rootPath) {
    const specDir = path.join(rootPath, ".spec");
    if (fs.existsSync(specDir)) {
      writeCopilotInstructions(rootPath, /* force */ false);
    }
  }
}

// ── Copilot instructions generator ──────────────────────────────────────────

const COPILOT_INSTRUCTIONS = `\
# Project Spec — AI Agent Instructions

This workspace uses the **Project Spec** VS Code extension. All project documentation lives in the \`.spec/\` folder as YAML front-matter markdown files.

## Available language model tools

Use these tools when working in this workspace:

| Tool | Purpose |
|------|---------|
| \`project-spec_read-spec\` | Read the full project specification (all item types) |
| \`project-spec_get-schema\` | Get the document schema and authoring guide — call this **before** creating or editing any spec file |
| \`project-spec_query\` | Filter spec items by \`type\` and/or \`status\` |
| \`project-spec_write-file\` | Create or overwrite a \`.spec/\` markdown file |
| \`project-spec_validate-file\` | Validate a spec file after writing |

## Workflow for creating or editing spec items

1. Call \`project-spec_get-schema\` to get the correct front-matter fields, directory location, and ID conventions for the target type.
2. Call \`project-spec_read-spec\` or \`project-spec_query\` to find existing IDs and determine the next available number.
3. Write the file with \`project-spec_write-file\` using the workspace-relative path (e.g. \`.spec/backlog/epics/epic-004.md\`).
4. Call \`project-spec_validate-file\` with the same path to confirm the file is valid.

## TYPE REGISTRY — the only 17 valid document types

The \`type\` field MUST be one of these exact strings. No other values are accepted — never invent types.

| \`type\` | \`id\` prefix | Directory under \`.spec/\` | File name | Valid \`status\` values |
|--------|-------------|--------------------------|-----------|----------------------|
| \`epic\` | \`EPIC-NNN\` | \`backlog/epics/\` | \`epic-NNN.md\` | \`draft\` · \`active\` · \`done\` |
| \`story\` | \`US-NNN\` | \`backlog/stories/\` | \`us-NNN.md\` | \`draft\` · \`active\` · \`done\` |
| \`task\` | \`TASK-NNN\` | \`backlog/tasks/\` | \`task-NNN.md\` | \`todo\` · \`in-progress\` · \`testing\` · \`blocked\` · \`done\` |
| \`bug\` | \`BUG-NNN\` | \`backlog/tasks/\` | \`bug-NNN.md\` | \`todo\` · \`in-progress\` · \`testing\` · \`blocked\` · \`done\` |
| \`fr\` | \`FR-NNN\` | \`requirements/fr/\` | \`fr-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`nfr\` | \`NFR-NNN\` | \`requirements/nfr/\` | \`nfr-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`sprint\` | \`SPR-NNN\` | \`planning/sprints/\` | \`spr-NNN.md\` | \`planned\` · \`active\` · \`done\` |
| \`release\` | \`REL-NNN\` | \`planning/releases/\` | \`rel-NNN.md\` | \`draft\` · \`active\` · \`released\` |
| \`adr\` | \`ADR-NNN\` | \`technical/adr/\` | \`adr-NNN.md\` | \`proposed\` · \`accepted\` · \`deprecated\` · \`superseded\` |
| \`arch\` | \`ARCH-NNN\` | \`technical/\` | \`arch-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`service\` | \`SRV-NNN\` | \`technical/services/\` | \`srv-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`data-proc\` | \`DP-NNN\` | \`technical/data-processes/\` | \`dp-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`db-table\` | \`TBL-NNN\` | \`technical/database/\` | \`tbl-NNN.md\` | \`draft\` · \`active\` · \`done\` |
| \`cicd\` | \`CICD-NNN\` | \`technical/cicd/\` | \`cicd-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`auth-spec\` | \`AUTH-NNN\` | \`technical/auth/\` | \`auth-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`member\` | \`MBR-NNN\` | \`team/members/\` | \`mbr-NNN.md\` | \`active\` · \`draft\` |
| \`concept\` | \`CON-NNN\` | \`concept/{section}/\` | \`con-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |

\`NNN\` = zero-padded 3-digit number (001, 002, …).
For \`concept\`, \`{section}\` ∈ \`history\` · \`goals\` · \`principles\` · \`risks\` · \`sysdesign\` · \`sysimpl\`.

## Key rules

- **type is strictly enforced** — only the 17 exact strings above are valid. Specifically invalid: \`spec\`, \`technical-spec\`, \`service-spec\`, \`auth\`, \`tech-spec\`, \`architecture\`.
- **Never** change an existing \`id\` field — IDs are immutable.
- \`title\` must always be enclosed in double quotes in front matter.
- \`epicId\` is required on every story; \`storyId\` is required on every task and bug.
- \`role\` is required on every member.
- \`processType\` (sync | async | cron) is required on every \`data-proc\` document.
- Comma-separated fields (\`linkedIds\`, \`dependsOn\`, \`relations\`) must have NO spaces around commas.
- Dates must be \`YYYY-MM-DD\` only.
- Always call \`project-spec_validate-file\` after writing a spec file.
- Call \`project-spec_get-schema\` before creating any file — it returns the full body templates and field reference.
`;

function writeCopilotInstructions(rootPath: string, force: boolean): void {
  const githubDir = path.join(rootPath, ".github");
  const filePath = path.join(githubDir, "copilot-instructions.md");

  if (!force && fs.existsSync(filePath)) {
    return;
  }

  try {
    if (!fs.existsSync(githubDir)) {
      fs.mkdirSync(githubDir, { recursive: true });
    }
    fs.writeFileSync(filePath, COPILOT_INSTRUCTIONS, "utf8");
  } catch {
    // Best-effort — don't crash activation if the write fails
  }
}

export function deactivate(): void {}
