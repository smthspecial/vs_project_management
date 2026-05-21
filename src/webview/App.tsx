import React, { useState, useEffect } from "react";
import { BoardView } from "./BoardView";
import { TimelineView } from "./TimelineView";
import { DependenciesView } from "./DependenciesView";
import { DatabaseView } from "./DatabaseView";
import { ItemData, View, ExtensionMessage } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const acquireVsCodeApi: () => { postMessage(msg: unknown): void };
// acquireVsCodeApi() can only be called once per webview, so all views
// share the instance they import from vscodeApi.ts.

export function App(): React.ReactElement {
  const [items, setItems] = useState<ItemData[]>([]);
  const [view, setView] = useState<View>("board");

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionMessage>) => {
      if (event.data.type === "update") {
        setItems(event.data.items);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <div className="app">
      <div className="toolbar">
        <span className="toolbar-title">Project View</span>
        <div className="tabs">
          <button
            className={`tab${view === "board" ? " active" : ""}`}
            onClick={() => setView("board")}
          >
            ⊞ Board
          </button>
          <button
            className={`tab${view === "timeline" ? " active" : ""}`}
            onClick={() => setView("timeline")}
          >
            📅 Timeline
          </button>
          <button
            className={`tab${view === "dependencies" ? " active" : ""}`}
            onClick={() => setView("dependencies")}
          >
            ⛓ Dependencies
          </button>
          <button
            className={`tab${view === "database" ? " active" : ""}`}
            onClick={() => setView("database")}
          >
            🗄 Database
          </button>
        </div>
      </div>
      <div className="content">
        {view === "board" && <BoardView items={items} />}
        {view === "timeline" && <TimelineView items={items} />}
        {view === "dependencies" && <DependenciesView items={items} />}
        {view === "database" && <DatabaseView items={items} />}
      </div>
    </div>
  );
}
