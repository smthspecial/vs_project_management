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
  dependsOn?: string; // comma-separated IDs
  startDate?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  filePath: string;
}

export type View = "board" | "timeline" | "dependencies";

// Messages extension → webview
export type ExtensionMessage = { type: "update"; items: ItemData[] };

// Messages webview → extension
export type WebviewMessage =
  | { type: "openFile"; filePath: string }
  | { type: "updateStatus"; id: string; status: string; filePath: string }
  | {
      type: "updateDates";
      id: string;
      startDate: string;
      dueDate: string;
      filePath: string;
    };
