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
  );
}

export function deactivate(): void {}
