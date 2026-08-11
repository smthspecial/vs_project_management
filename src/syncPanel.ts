import * as vscode from "vscode";
import * as path from "path";
import { SyncTreeDataProvider } from "./syncTree";
import type { SpecTreeDataProvider } from "./specTree";
import {
  fetchRemote,
  stageAndCommitSpec,
  pushBranch,
  pullBranch,
  getRemoteUrl,
  buildPrUrl,
} from "./gitSync";

export interface SyncPanel {
  syncProvider: SyncTreeDataProvider;
  refresh: () => Promise<void>;
}

// The Sync sidebar panel: its tree view, the git-branch status bar item,
// periodic remote fetching, and the commit/push/pull/open-PR commands.
// Returns the sync provider and a refresh function so other subsystems
// (e.g. the workspace-folder-change handler) can trigger a re-sync.
export function registerSyncPanel(
  context: vscode.ExtensionContext,
  getRootPath: () => string | undefined,
  rootPath: string,
  provider: SpecTreeDataProvider,
): SyncPanel {
  const syncProvider = new SyncTreeDataProvider();
  if (rootPath) {
    syncProvider.setRootPath(rootPath);
  }

  const syncView = vscode.window.createTreeView("projectSpecSyncTree", {
    treeDataProvider: syncProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(syncView);

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

  async function refresh(): Promise<void> {
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
    void fetchRemote(rootPath).then(() => refresh());
  }

  // Auto-fetch every 5 minutes (guarded against overlapping runs)
  let syncFetchInFlight = false;
  const autoFetchInterval = setInterval(
    () => {
      if (syncFetchInFlight) {
        return;
      }
      const rp = getRootPath();
      if (rp) {
        syncFetchInFlight = true;
        void fetchRemote(rp)
          .then(() => refresh())
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

  registerSyncCommands(context, getRootPath, provider, syncProvider, refresh);

  return { syncProvider, refresh };
}

function registerSyncCommands(
  context: vscode.ExtensionContext,
  getRootPath: () => string | undefined,
  provider: SpecTreeDataProvider,
  syncProvider: SyncTreeDataProvider,
  refresh: () => Promise<void>,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("project-spec.syncRefresh", async () => {
      const rp = getRootPath();
      if (rp) {
        await fetchRemote(rp);
      }
      await refresh();
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
        await refresh();
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
        await refresh();
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
        await refresh();
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
