import * as vscode from "vscode";
import { SpecItem } from "../models";
import { STYLES } from "./styles";
import { getNonce } from "./utils";

// ---------------------------------------------------------------------------
// PlanningPanel — manages the central editor webview panel
// ---------------------------------------------------------------------------

export class PlanningPanel {
  static readonly viewType = "projectSpecPlanning";
  private static _instance: PlanningPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private _items: SpecItem[] = [];
  private readonly _extensionUri: vscode.Uri;
  private readonly _disposables: vscode.Disposable[] = [];
  private _initialView: string | undefined;

  // Callback for persisting changes back to markdown files
  private readonly _onPatch: (
    filePath: string,
    patch: Record<string, string>,
  ) => void;

  // Callback for deleting a file (e.g. a db-table)
  private readonly _onDelete: (filePath: string) => void;

  // ---------------------------------------------------------------------------

  static createOrShow(
    context: vscode.ExtensionContext,
    items: SpecItem[],
    onPatch: (filePath: string, patch: Record<string, string>) => void,
    onDelete: (filePath: string) => void,
    initialView?: string,
  ): void {
    const column = vscode.ViewColumn.One;

    if (PlanningPanel._instance) {
      PlanningPanel._instance._panel.reveal(column);
      PlanningPanel._instance.update(items);
      if (initialView) {
        PlanningPanel._instance._panel.webview.postMessage({
          type: "setView",
          view: initialView,
        });
      }
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PlanningPanel.viewType,
      "Project View",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist")],
      },
    );

    PlanningPanel._instance = new PlanningPanel(
      panel,
      context.extensionUri,
      items,
      onPatch,
      onDelete,
      initialView,
    );
  }

  static update(items: SpecItem[]): void {
    PlanningPanel._instance?.update(items);
  }

  // ---------------------------------------------------------------------------

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    items: SpecItem[],
    onPatch: (filePath: string, patch: Record<string, string>) => void,
    onDelete: (filePath: string) => void,
    initialView?: string,
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._items = items;
    this._initialView = initialView;
    this._onPatch = onPatch;
    this._onDelete = onDelete;

    this._panel.iconPath = new vscode.ThemeIcon("project");
    this._panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist")],
    };

    this._panel.webview.html = this._buildHtml();

    // Send items as soon as the webview is ready
    this._panel.webview.onDidReceiveMessage(
      (msg: {
        type: string;
        filePath?: string;
        id?: string;
        status?: string;
        startDate?: string;
        dueDate?: string;
        sprintId?: string;
        releaseId?: string;
      }) => {
        if (msg.type === "ready") {
          this._postItems();
          if (this._initialView) {
            this._panel.webview.postMessage({
              type: "setView",
              view: this._initialView,
            });
          }
          return;
        }
        if (msg.type === "openFile" && msg.filePath) {
          const uri = vscode.Uri.file(msg.filePath);
          vscode.commands.executeCommand(
            "project-spec._revealInTree",
            msg.filePath,
          );
          vscode.window.showTextDocument(uri);
        } else if (
          msg.type === "updateStatus" &&
          msg.filePath &&
          msg.id &&
          msg.status
        ) {
          this._onPatch(msg.filePath, { status: msg.status });
        } else if (
          msg.type === "updateDates" &&
          msg.filePath &&
          msg.startDate &&
          msg.dueDate
        ) {
          this._onPatch(msg.filePath, {
            startDate: msg.startDate,
            dueDate: msg.dueDate,
          });
        } else if (msg.type === "updateSprint" && msg.filePath) {
          this._onPatch(msg.filePath, { sprintId: msg.sprintId ?? "" });
        } else if (msg.type === "updateRelease" && msg.filePath) {
          this._onPatch(msg.filePath, { releaseId: msg.releaseId ?? "" });
        } else if (msg.type === "createTable") {
          vscode.commands.executeCommand("project-spec.newTable");
        } else if (msg.type === "deleteTable" && msg.filePath) {
          this._onDelete(msg.filePath);
        }
      },
      null,
      this._disposables,
    );

    this._panel.onDidDispose(() => this._dispose(), null, this._disposables);
  }

  update(items: SpecItem[]): void {
    this._items = items;
    this._postItems();
  }

  private _postItems(): void {
    const data = this._items.map((i) => ({
      id: i.data.id,
      type: i.data.type,
      title: i.data.title,
      status: i.data.status,
      priority: i.data.priority,
      epicId: i.data.epicId,
      storyId: i.data.storyId,
      sprintId: i.data.sprintId,
      releaseId: i.data.releaseId,
      dependsOn: i.data.dependsOn,
      startDate: i.data.startDate,
      dueDate: i.data.dueDate,
      releaseDate: i.data.releaseDate,
      filePath: i.filePath,
      ...(i.data.type === "db-table"
        ? { body: i.body, relations: i.data.relations }
        : {}),
      assigneeId: i.data.assigneeId,
      role: i.data.role,
    }));
    this._panel.webview.postMessage({ type: "update", items: data });
  }

  private _buildHtml(): string {
    const webviewUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "webview.js"),
    );
    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src 'unsafe-inline';
             script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project View</title>
  <style>${STYLES}</style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${webviewUri}"></script>
</body>
</html>`;
  }

  private _dispose(): void {
    PlanningPanel._instance = undefined;
    this._panel.dispose();
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables.length = 0;
  }
}
