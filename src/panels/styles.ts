// ---------------------------------------------------------------------------
// CSS styles injected into the planning panel webview
// ---------------------------------------------------------------------------

export const STYLES = /* css */ `
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

  /* ── Loading ── */
  .loading-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    opacity: 0.6;
  }

  .loading-spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--vscode-panel-border);
    border-top-color: var(--vscode-progressBar-background);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loading-text {
    font-size: 13px;
    color: var(--vscode-descriptionForeground);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

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

  .card-status {
    margin-left: auto;
    font-size: 10px;
    opacity: 0.55;
    font-style: italic;
  }

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

  .card-assignee {
    margin-top: 4px;
    font-size: 10px;
    opacity: 0.75;
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
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--vscode-editor-background);
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

  .sprint-fold-btn {
    background: none;
    border: none;
    color: var(--vscode-foreground);
    opacity: 0.6;
    font-size: 8px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
    flex-shrink: 0;
  }
  .sprint-fold-btn:hover { opacity: 1; }

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

  /* ── Database ── */
  .db-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .db-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-editor-background);
    flex-shrink: 0;
  }

  .db-toolbar-title {
    font-size: 12px;
    font-weight: 600;
    opacity: 0.8;
  }

  .db-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 11px;
    cursor: pointer;
    font-family: inherit;
  }
  .db-btn:hover {
    background: var(--vscode-button-hoverBackground);
  }

  .db-canvas {
    flex: 1;
    position: relative;
    overflow: hidden;
    cursor: grab;
    background: var(--vscode-editor-background);
  }
  .db-canvas:active {
    cursor: grabbing;
  }

  .db-node {
    background: var(--vscode-editor-widget-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    user-select: none;
    cursor: grab;
  }
  .db-node:active {
    cursor: grabbing;
    box-shadow: 0 4px 16px rgba(0,0,0,0.35);
  }
  .db-node--selected {
    border-color: #60a5fa;
    box-shadow: 0 0 0 2px rgba(96,165,250,0.35), 0 4px 16px rgba(0,0,0,0.35);
  }

  .db-node-header {
    display: flex;
    align-items: center;
    padding: 0 8px;
    height: 36px;
    background: var(--vscode-tab-activeBackground);
    border-bottom: 1px solid var(--vscode-panel-border);
    gap: 6px;
  }

  .db-node-name {
    flex: 1;
    font-size: 11px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    color: var(--vscode-textLink-foreground);
  }
  .db-node-name:hover {
    text-decoration: underline;
  }

  .db-node-del {
    background: none;
    border: none;
    color: var(--vscode-foreground);
    opacity: 0.4;
    font-size: 14px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    flex-shrink: 0;
  }
  .db-node-del:hover {
    opacity: 1;
    color: var(--vscode-errorForeground);
  }

  .db-node-cols {
    padding: 4px 0 4px 0;
  }

  .db-col-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px;
    height: 22px;
    font-size: 10px;
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  .db-col-row:last-child {
    border-bottom: none;
  }

  .db-col-icon {
    font-size: 9px;
    flex-shrink: 0;
    width: 14px;
    text-align: center;
  }

  .db-col-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--vscode-foreground);
  }

  .db-col-type {
    font-size: 9px;
    opacity: 0.55;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 80px;
  }

  .db-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    opacity: 0.7;
    font-size: 13px;
  }

  .db-empty-icon {
    font-size: 40px;
    opacity: 0.5;
  }
`;
