import * as vscode from "vscode";
import { SpecItem } from "./models";

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const COLUMNS: { id: string; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "done", label: "Done" },
  { id: "blocked", label: "Blocked" },
];

const PRIORITY_ICON: Record<string, string> = {
  high: "↑",
  medium: "–",
  low: "↓",
};

// ---------------------------------------------------------------------------
// View provider (embedded panel)
// ---------------------------------------------------------------------------

export class KanbanViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "projectSpecKanban";

  private _view?: vscode.WebviewView;
  private _items: SpecItem[] = [];

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = { enableScripts: true };

    webviewView.webview.onDidReceiveMessage(
      (msg: { command: string; filePath: string }) => {
        if (msg.command === "openFile") {
          vscode.window.showTextDocument(vscode.Uri.file(msg.filePath));
        }
      },
    );

    this._render();
  }

  update(items: SpecItem[]): void {
    this._items = items;
    this._render();
  }

  private _render(): void {
    if (this._view) {
      this._view.webview.html = this._buildHtml();
    }
  }

  // ---------------------------------------------------------------------------
  // HTML
  // ---------------------------------------------------------------------------

  private _buildHtml(): string {
    const boardItems = this._items.filter(
      (i) => i.data.type === "task" || i.data.type === "bug",
    );

    const storyMap = new Map(
      this._items
        .filter((i) => i.data.type === "story")
        .map((i) => [i.data.id, i.data.title]),
    );

    const columns = COLUMNS.map(({ id, label }) => {
      const cards = boardItems.filter((i) => i.data.status === id);
      const cardsHtml = cards.length
        ? cards.map((i) => this._card(i, storyMap)).join("")
        : `<div class="empty">No items</div>`;
      return `
        <div class="column">
          <div class="column-header">
            <span>${this._esc(label)}</span>
            <span class="count">${cards.length}</span>
          </div>
          <div class="cards">${cardsHtml}</div>
        </div>`;
    }).join("");

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kanban</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 16px;
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  h1 {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.4px;
    margin-bottom: 12px;
    opacity: 0.75;
  }
  .board {
    display: flex;
    gap: 10px;
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .column {
    flex: 0 0 200px;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #444));
    border-radius: 6px;
    overflow: hidden;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
  }
  .column-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 10px;
    font-weight: 700;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.7px;
    background: var(--vscode-sideBarSectionHeader-background, rgba(128,128,128,0.1));
    border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #444));
    flex-shrink: 0;
  }
  .count {
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
    border-radius: 8px;
    padding: 1px 6px;
    font-size: 10px;
    font-weight: 600;
  }
  .cards {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .card {
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #444));
    border-radius: 4px;
    padding: 8px 9px;
    cursor: pointer;
  }
  .card:hover {
    border-color: var(--vscode-focusBorder, #007fd4);
    background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.05));
  }
  .card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
    gap: 4px;
  }
  .badge {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.4px;
    padding: 1px 5px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .badge-task { background: #1a6faf; color: #fff; }
  .badge-bug  { background: #a1200a; color: #fff; }
  .priority {
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .priority-high   { color: var(--vscode-charts-red,    #f14c4c); }
  .priority-medium { color: var(--vscode-charts-yellow, #cca700); }
  .priority-low    { color: var(--vscode-charts-blue,   #3794ff); }
  .card-title {
    font-size: 12px;
    line-height: 1.4;
    word-break: break-word;
    margin-bottom: 5px;
  }
  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 4px;
  }
  .card-id {
    font-size: 10px;
    opacity: 0.45;
    flex-shrink: 0;
  }
  .story-tag {
    font-size: 10px;
    opacity: 0.55;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: right;
  }
  .empty {
    color: var(--vscode-disabledForeground, #888);
    font-size: 11px;
    text-align: center;
    padding: 14px 0;
    opacity: 0.7;
  }
</style>
</head>
<body>
<h1>Kanban Board</h1>
<div class="board">${columns}</div>
<script>
  const vscode = acquireVsCodeApi();
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      vscode.postMessage({ command: 'openFile', filePath: card.dataset.path });
    });
  });
</script>
</body>
</html>`;
  }

  private _card(item: SpecItem, storyMap: Map<string, string>): string {
    const { id, type, title, priority, storyId } = item.data;
    const priorityIcon = priority ? (PRIORITY_ICON[priority] ?? "") : "";
    const storyTitle = storyId ? storyMap.get(storyId) : undefined;

    return `<div class="card" data-path="${this._attr(item.filePath)}">
  <div class="card-meta">
    <span class="badge badge-${this._esc(type)}">${type.toUpperCase()}</span>
    ${priority ? `<span class="priority priority-${this._esc(priority)}">${priorityIcon}</span>` : ""}
  </div>
  <div class="card-title">${this._esc(title)}</div>
  <div class="card-footer">
    <span class="card-id">${this._esc(id)}</span>
    ${storyTitle ? `<span class="story-tag" title="${this._attr(storyTitle)}">${this._esc(storyTitle)}</span>` : ""}
  </div>
</div>`;
  }

  private _esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  private _attr(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }
}
