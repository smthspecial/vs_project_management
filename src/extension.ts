import * as vscode from "vscode";
import * as fs from "fs";
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
