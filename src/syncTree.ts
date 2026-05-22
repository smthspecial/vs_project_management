import * as vscode from "vscode";
import * as path from "path";
import {
  isGitRepo,
  getRemoteStatus,
  getChangedSpecFiles,
  RemoteStatus,
  ChangedFile,
} from "./gitSync";

// ---------------------------------------------------------------------------
// Tree item types
// ---------------------------------------------------------------------------

class BranchItem extends vscode.TreeItem {
  constructor(status: RemoteStatus) {
    super(
      status.branch === "unknown" ? "Not in a git repository" : status.branch,
      vscode.TreeItemCollapsibleState.None,
    );
    this.iconPath = new vscode.ThemeIcon("git-branch");
    this.contextValue = "sync-branch";

    if (status.branch !== "unknown") {
      if (status.hasRemote) {
        const parts: string[] = [];
        if (status.ahead > 0) {
          parts.push(`↑${status.ahead}`);
        }
        if (status.behind > 0) {
          parts.push(`↓${status.behind}`);
        }
        this.description = parts.length ? parts.join("  ") : "up to date";
      } else {
        this.description = "no remote";
      }
    }
  }
}

class ActionItem extends vscode.TreeItem {
  constructor(label: string, cmd: string, iconId: string, tooltip?: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(iconId);
    this.command = { command: cmd, title: label };
    this.tooltip = tooltip;
    this.contextValue = "sync-action";
  }
}

class FileItem extends vscode.TreeItem {
  constructor(file: ChangedFile, rootPath: string) {
    super(path.basename(file.path), vscode.TreeItemCollapsibleState.None);
    this.description = file.path;
    this.tooltip = `${file.xy}  ${file.path}`;
    this.contextValue = "sync-file";

    const iconMap: Record<string, string> = {
      M: "diff-modified",
      A: "diff-added",
      D: "diff-removed",
      R: "diff-renamed",
      "??": "diff-added",
    };
    this.iconPath = new vscode.ThemeIcon(iconMap[file.xy] ?? "circle-outline");

    // Open file on click, but only if it hasn't been deleted
    if (!file.xy.includes("D")) {
      this.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [vscode.Uri.file(path.join(rootPath, file.path))],
      };
    }
  }
}

class InfoItem extends vscode.TreeItem {
  constructor(label: string, iconId: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(iconId);
    this.contextValue = "sync-info";
  }
}

type AnyItem = BranchItem | ActionItem | FileItem | InfoItem;

// ---------------------------------------------------------------------------
// Tree data provider
// ---------------------------------------------------------------------------

export class SyncTreeDataProvider implements vscode.TreeDataProvider<AnyItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private rootPath = "";
  private _isGit = false;
  private _status: RemoteStatus = {
    branch: "unknown",
    ahead: 0,
    behind: 0,
    hasRemote: false,
  };
  private _changedFiles: ChangedFile[] = [];

  setRootPath(rp: string): void {
    this.rootPath = rp;
  }

  getRemoteStatus(): RemoteStatus {
    return this._status;
  }

  getChangedFiles(): ChangedFile[] {
    return this._changedFiles;
  }

  /** Reload git state and re-render. */
  async refresh(): Promise<void> {
    if (!this.rootPath) {
      return;
    }
    this._isGit = await isGitRepo(this.rootPath);
    if (this._isGit) {
      [this._status, this._changedFiles] = await Promise.all([
        getRemoteStatus(this.rootPath),
        getChangedSpecFiles(this.rootPath),
      ]);
    }
    this._onDidChangeTreeData.fire();
  }

  /** Force a UI refresh without re-reading git state (e.g. after an external change). */
  fire(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(el: AnyItem): vscode.TreeItem {
    return el;
  }

  getChildren(): AnyItem[] {
    if (!this._isGit) {
      return [new InfoItem("Not a git repository", "warning")];
    }

    const items: AnyItem[] = [new BranchItem(this._status)];

    // Remote sync actions
    if (this._status.hasRemote) {
      if (this._status.behind > 0) {
        const n = this._status.behind;
        items.push(
          new ActionItem(
            `Pull ${n} commit${n !== 1 ? "s" : ""} from remote`,
            "project-spec.syncPull",
            "cloud-download",
            "Pull and rebase on remote changes",
          ),
        );
      }
      if (this._status.ahead > 0) {
        const n = this._status.ahead;
        items.push(
          new ActionItem(
            `Push ${n} commit${n !== 1 ? "s" : ""} to remote`,
            "project-spec.syncPush",
            "cloud-upload",
            "Push your branch to origin",
          ),
        );
        items.push(
          new ActionItem(
            "Open Pull Request",
            "project-spec.syncOpenPR",
            "git-pull-request",
            "Open a new pull request in your browser",
          ),
        );
      }
    }

    // Uncommitted spec changes
    if (this._changedFiles.length > 0) {
      const n = this._changedFiles.length;
      items.push(
        new ActionItem(
          `Commit ${n} spec change${n !== 1 ? "s" : ""}…`,
          "project-spec.syncCommit",
          "git-commit",
          "Stage and commit all .spec/ changes",
        ),
      );
      for (const f of this._changedFiles) {
        items.push(new FileItem(f, this.rootPath));
      }
    } else if (
      this._status.ahead === 0 &&
      this._status.behind === 0 &&
      this._status.hasRemote
    ) {
      items.push(new InfoItem("Everything up to date", "pass-filled"));
    }

    return items;
  }
}
