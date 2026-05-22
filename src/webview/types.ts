// Serialisable item sent from the extension to the webview.
// Mirrors SpecFrontMatter but without file I/O concerns.
export interface ItemData {
  id: string;
  type: string;
  title: string;
  status: string;
  priority?: string;
  epicId?: string;
  storyId?: string;
  sprintId?: string;
  releaseId?: string;
  dependsOn?: string; // comma-separated IDs
  startDate?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  releaseDate?: string; // YYYY-MM-DD
  filePath: string;
  body?: string; // raw markdown body (only sent for db-table items)
  relations?: string; // FK relations: "col:TBL-ID,col:TBL-ID"
  assigneeId?: string; // member ID assigned to this task/bug
  role?: string; // role of a member
}

export type View = "board" | "timeline" | "dependencies" | "database";

// Messages extension → webview
export type ExtensionMessage =
  | { type: "update"; items: ItemData[] }
  | { type: "setView"; view: View };

// Messages webview → extension
export type WebviewMessage =
  | { type: "ready" }
  | { type: "openFile"; filePath: string }
  | { type: "updateStatus"; id: string; status: string; filePath: string }
  | {
      type: "updateDates";
      id: string;
      startDate: string;
      dueDate: string;
      filePath: string;
    }
  | { type: "updateSprint"; id: string; sprintId: string; filePath: string }
  | { type: "updateRelease"; id: string; releaseId: string; filePath: string }
  | { type: "createTable" }
  | { type: "deleteTable"; id: string; filePath: string };
