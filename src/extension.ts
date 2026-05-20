import * as vscode from "vscode";
import { SpecTreeDataProvider } from "./specTree";
import { registerCommands } from "./commands";
import { SpecCodeLensProvider } from "./codeLens";
import { KanbanViewProvider } from "./kanban";
import { PlanningPanel, patchFrontMatter } from "./planningPanel";

export function activate(context: vscode.ExtensionContext): void {
  const getRootPath = (): string | undefined =>
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  // Use a placeholder root; provider handles missing workspace gracefully
  const rootPath = getRootPath() ?? "";
  const provider = new SpecTreeDataProvider(rootPath);

  // Tree view — always register so the panel appears
  const treeView = vscode.window.createTreeView("projectSpecTree", {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Commands — always register so they work from the command palette
  registerCommands(context, provider, getRootPath);

  // Kanban board — embedded panel view
  const kanbanProvider = new KanbanViewProvider();
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      KanbanViewProvider.viewType,
      kanbanProvider,
    ),
  );

  // Sync context key, kanban and planning panel whenever tree data changes
  const syncState = (): void => {
    const items = provider.getAllItems();
    const hasSrs = items.some((i) => i.data.type === "epic");
    vscode.commands.executeCommand("setContext", "projectSpec.hasEpic", hasSrs);
    kanbanProvider.update(items);
    PlanningPanel.update(items);
  };

  // Open Planning panel command
  context.subscriptions.push(
    vscode.commands.registerCommand("project-spec.openPlanning", () => {
      PlanningPanel.createOrShow(
        context,
        provider.getAllItems(),
        (filePath, patch) => {
          patchFrontMatter(filePath, patch);
          provider.refresh();
        },
      );
    }),
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
      }
    }),
  );
}

export function deactivate(): void {}
