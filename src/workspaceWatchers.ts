import * as vscode from "vscode";
import type { SpecTreeDataProvider } from "./specTree";
import type { SyncPanel } from "./syncPanel";

// Refreshes the spec tree whenever a .spec/**/*.md file is created, edited,
// or deleted on disk — including changes made outside the editor (git pull,
// another tool, etc.).
export function registerSpecFileWatcher(
  context: vscode.ExtensionContext,
  rootPath: string,
  provider: SpecTreeDataProvider,
): void {
  if (!rootPath) {
    return;
  }
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(rootPath, ".spec/**/*.md"),
  );
  watcher.onDidCreate(() => provider.refresh());
  watcher.onDidChange(() => provider.refresh());
  watcher.onDidDelete(() => provider.refresh());
  context.subscriptions.push(watcher);
}

// Re-points both the spec tree and the sync panel at the new root when a
// workspace folder is added (e.g. the user opens a folder after activation).
export function registerWorkspaceFolderChangeHandler(
  context: vscode.ExtensionContext,
  getRootPath: () => string | undefined,
  provider: SpecTreeDataProvider,
  sync: SyncPanel,
): void {
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      const newRoot = getRootPath();
      if (newRoot) {
        provider.setRootPath(newRoot);
        sync.syncProvider.setRootPath(newRoot);
        void sync.refresh();
      }
    }),
  );
}
