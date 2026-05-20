import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { SpecItem, SpecFrontMatter } from "./models";
import { parseFrontMatter, buildFrontMatter } from "./specParser";

// ---------------------------------------------------------------------------
// Styles injected into the webview
// ---------------------------------------------------------------------------

const STYLES = /* css */ `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Toolbar ── */
  .app { display: flex; flex-direction: column; height: 100vh; }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 16px;
    background: var(--vscode-tab-activeBackground);
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
  }

  .toolbar-title {
    font-weight: 600;
    font-size: 13px;
    opacity: 0.85;
  }

  .tabs { display: flex; gap: 4px; }

  .tab {
    background: transparent;
    border: 1px solid var(--vscode-panel-border);
    color: var(--vscode-foreground);
    padding: 4px 14px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    opacity: 0.75;
    transition: opacity 0.15s;
  }

  .tab:hover { opacity: 1; background: var(--vscode-list-hoverBackground); }
  .tab.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: transparent;
    opacity: 1;
  }

  .content { flex: 1; overflow: hidden; }

  /* ── Board ── */
  .board {
    display: flex;
    gap: 12px;
    padding: 16px;
    height: 100%;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .column {
    flex: 0 0 220px;
    display: flex;
    flex-direction: column;
    background: var(--vscode-list-hoverBackground);
    border-radius: 6px;
    overflow: hidden;
  }

  .column-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    background: var(--vscode-tab-activeBackground);
    border-bottom: 1px solid var(--vscode-panel-border);
  }

  .count {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    border-radius: 10px;
    padding: 1px 7px;
    font-size: 10px;
  }

  .cards {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .card {
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 5px;
    padding: 8px 10px;
    cursor: grab;
    transition: border-color 0.15s, opacity 0.15s, box-shadow 0.15s;
  }
  .card:hover { border-color: var(--vscode-focusBorder); }
  .card:active { cursor: grabbing; }
  .card[draggable="true"]:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  }

  .column.drag-over .cards {
    background: var(--vscode-list-activeSelectionBackground);
    opacity: 0.85;
    outline: 2px dashed var(--vscode-focusBorder);
    outline-offset: -4px;
    border-radius: 4px;
  }

  .drop-placeholder {
    height: 36px;
    border-radius: 4px;
    border: 2px dashed var(--vscode-focusBorder);
    opacity: 0.5;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .status-select {
    margin-left: auto;
    background: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border);
    border-radius: 3px;
    font-size: 10px;
    padding: 1px 3px;
    font-family: inherit;
    cursor: pointer;
  }

  .priority { font-size: 13px; opacity: 0.7; }

  .card-title {
    font-size: 12px;
    line-height: 1.4;
    margin-bottom: 4px;
    word-break: break-word;
  }

  .card-id { font-size: 10px; opacity: 0.5; }

  .card-tag {
    margin-top: 5px;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 10px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-deps {
    margin-top: 4px;
    font-size: 10px;
    opacity: 0.65;
    word-break: break-all;
  }

  .empty { padding: 8px; font-size: 11px; opacity: 0.4; text-align: center; }

  /* ── Timeline ── */
  .timeline-root {
    display: flex;
    height: 100%;
    overflow: hidden;
  }

  .timeline-labels {
    flex: 0 0 220px;
    overflow-y: auto;
    overflow-x: hidden;
    border-right: 1px solid var(--vscode-panel-border);
    background: var(--vscode-editor-background);
  }

  .timeline-label-header {
    display: flex;
    align-items: center;
    padding: 0 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.7;
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
  }

  .timeline-label-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px 0 12px;
    font-size: 11px;
    cursor: pointer;
    border-bottom: 1px solid var(--vscode-panel-border);
    border-left: 3px solid transparent;
    transition: background 0.1s;
    overflow: hidden;
  }
  .timeline-label-row:hover { background: var(--vscode-list-hoverBackground); }

  .label-type {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    opacity: 0.6;
    flex-shrink: 0;
  }

  .label-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .label-dep { font-size: 11px; flex-shrink: 0; }
  .label-add { font-size: 10px; color: var(--vscode-textLink-foreground); flex-shrink: 0; }

  .unplanned-header {
    height: 28px !important;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    opacity: 0.5;
    background: var(--vscode-list-hoverBackground);
    cursor: default !important;
  }

  .unplanned { opacity: 0.65; }
  .unplanned:hover { opacity: 1; }

  .timeline-chart {
    flex: 1;
    overflow: auto;
    position: relative;
  }

  .timeline-chart.drop-target {
    outline: 2px dashed var(--vscode-focusBorder);
    outline-offset: -3px;
  }

  /* ── Dependencies ── */
  .dep-root {
    flex: 1;
    overflow: auto;
    padding: 16px;
    background: var(--vscode-editor-background);
  }

  .dep-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    opacity: 0.6;
    font-size: 13px;
    gap: 8px;
  }

  .dep-empty-icon {
    font-size: 36px;
    margin-bottom: 8px;
    opacity: 0.4;
  }

  .dep-empty code {
    font-family: var(--vscode-editor-font-family, monospace);
    background: var(--vscode-textBlockQuote-background);
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 11px;
  }
`;

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

  // Callback for persisting changes back to markdown files
  private readonly _onPatch: (
    filePath: string,
    patch: Record<string, string>,
  ) => void;

  // ---------------------------------------------------------------------------

  static createOrShow(
    context: vscode.ExtensionContext,
    items: SpecItem[],
    onPatch: (filePath: string, patch: Record<string, string>) => void,
  ): void {
    const column = vscode.ViewColumn.One;

    if (PlanningPanel._instance) {
      PlanningPanel._instance._panel.reveal(column);
      PlanningPanel._instance.update(items);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PlanningPanel.viewType,
      "Project Planning",
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
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._items = items;
    this._onPatch = onPatch;

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
      }) => {
        if (msg.type === "openFile" && msg.filePath) {
          vscode.window.showTextDocument(vscode.Uri.file(msg.filePath));
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
        }
      },
      null,
      this._disposables,
    );

    this._panel.onDidDispose(() => this._dispose(), null, this._disposables);

    // Push items after initial render
    setTimeout(() => this._postItems(), 100);
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
      dependsOn: i.data.dependsOn,
      startDate: i.data.startDate,
      dueDate: i.data.dueDate,
      filePath: i.filePath,
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
  <title>Project Planning</title>
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

// ---------------------------------------------------------------------------
// Patch helper — apply key/value changes to a file's front matter
// ---------------------------------------------------------------------------

export function patchFrontMatter(
  filePath: string,
  patch: Record<string, string>,
): void {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const { data, body } = parseFrontMatter(content);
  // Apply patch onto the parsed data object
  Object.assign(data, patch);
  const updated = buildFrontMatter(data as SpecFrontMatter) + body;
  fs.writeFileSync(filePath, updated, "utf-8");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
