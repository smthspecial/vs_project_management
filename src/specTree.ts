import * as vscode from "vscode";
import { SpecItem } from "./models";
import { readAllSpecItems } from "./specParser";

// ---------------------------------------------------------------------------
// Tree item
// ---------------------------------------------------------------------------

const TYPE_ICON: Record<string, string> = {
  epic: "milestone",
  story: "person",
  task: "checklist",
  bug: "bug",
  fr: "symbol-interface",
  nfr: "symbol-property",
  adr: "history",
  arch: "layout",
  "tech-spec": "file-code",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "○",
  active: "●",
  "in-progress": "◑",
  todo: "○",
  done: "✓",
  closed: "✗",
  proposed: "?",
  accepted: "✓",
  deprecated: "↓",
  superseded: "↻",
};

export class SpecTreeItem extends vscode.TreeItem {
  constructor(
    public readonly spec: SpecItem,
    collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(spec.data.title, collapsibleState);

    const { type, id, status } = spec.data;

    // Unique stable id for VS Code state persistence
    this.id = `${type}:${id}`;
    this.contextValue = type;

    const badge = STATUS_BADGE[status] ?? "○";
    this.description = `${badge} ${id}`;

    this.tooltip = new vscode.MarkdownString(
      `**${id}** · ${status}\n\n${spec.data.title}`,
    );

    this.iconPath = new vscode.ThemeIcon(
      TYPE_ICON[type] ?? "file",
      new vscode.ThemeColor(
        `charts.${status === "done" ? "green" : status === "in-progress" ? "yellow" : "foreground"}`,
      ),
    );

    this.command = {
      command: "project-spec.openFile",
      title: "Open",
      arguments: [spec.filePath],
    };
  }
}

// ---------------------------------------------------------------------------
// Group item (section header)
// ---------------------------------------------------------------------------

export class TreeGroupItem extends vscode.TreeItem {
  constructor(
    public readonly groupId: string,
    label: string,
    icon: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.id = `group:${groupId}`;
    this.contextValue = `group-${groupId}`;
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}

export type AnyTreeItem = SpecTreeItem | TreeGroupItem;

// ---------------------------------------------------------------------------
// Tree data provider
// ---------------------------------------------------------------------------

export class SpecTreeDataProvider implements vscode.TreeDataProvider<AnyTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    AnyTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private items: SpecItem[] = [];

  constructor(private rootPath: string) {
    this.load();
  }

  setRootPath(rootPath: string): void {
    this.rootPath = rootPath;
    this.refresh();
  }

  refresh(): void {
    this.load();
    this._onDidChangeTreeData.fire();
  }

  private load(): void {
    this.items = readAllSpecItems(this.rootPath);
  }

  getAllItems(): SpecItem[] {
    return this.items;
  }

  getTreeItem(element: AnyTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AnyTreeItem): AnyTreeItem[] {
    if (!element) {
      return [
        new TreeGroupItem("requirements", "Requirements", "list-unordered"),
        new TreeGroupItem("planning", "Planning", "project"),
        new TreeGroupItem("technical", "Technical", "circuit-board"),
      ];
    }

    if (element instanceof TreeGroupItem) {
      switch (element.groupId) {
        case "requirements":
          return [
            new TreeGroupItem(
              "fr",
              "Functional Requirements",
              "symbol-interface",
            ),
            new TreeGroupItem(
              "nfr",
              "Non-Functional Requirements",
              "symbol-property",
            ),
          ];
        case "planning":
          return this.items
            .filter((i) => i.data.type === "epic")
            .sort((a, b) => a.data.id.localeCompare(b.data.id))
            .map((i) => {
              const hasStories = this.items.some(
                (s) => s.data.type === "story" && s.data.epicId === i.data.id,
              );
              return new SpecTreeItem(
                i,
                hasStories
                  ? vscode.TreeItemCollapsibleState.Expanded
                  : vscode.TreeItemCollapsibleState.Collapsed,
              );
            });
        case "technical":
          return [
            new TreeGroupItem("adr", "Architectural Decisions", "history"),
            new TreeGroupItem("arch", "Architecture Design", "layout"),
            new TreeGroupItem("spec", "Technical Specs", "file-code"),
          ];
        case "fr":
          return this.items
            .filter((i) => i.data.type === "fr")
            .sort((a, b) => a.data.id.localeCompare(b.data.id))
            .map(
              (i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None),
            );
        case "nfr":
          return this.items
            .filter((i) => i.data.type === "nfr")
            .sort((a, b) => a.data.id.localeCompare(b.data.id))
            .map(
              (i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None),
            );
        case "adr":
          return this.items
            .filter((i) => i.data.type === "adr")
            .sort((a, b) => a.data.id.localeCompare(b.data.id))
            .map(
              (i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None),
            );
        case "arch":
          return this.items
            .filter((i) => i.data.type === "arch")
            .sort((a, b) => a.data.id.localeCompare(b.data.id))
            .map(
              (i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None),
            );
        case "spec":
          return this.items
            .filter((i) => i.data.type === "tech-spec")
            .sort((a, b) => a.data.id.localeCompare(b.data.id))
            .map(
              (i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None),
            );
        default:
          return [];
      }
    }

    // SpecTreeItem children
    const { type, id } = element.spec.data;

    if (type === "epic") {
      return this.items
        .filter((i) => i.data.type === "story" && i.data.epicId === id)
        .sort((a, b) => a.data.id.localeCompare(b.data.id))
        .map((i) => {
          const hasTasks = this.items.some(
            (t) =>
              (t.data.type === "task" || t.data.type === "bug") &&
              t.data.storyId === i.data.id,
          );
          return new SpecTreeItem(
            i,
            hasTasks
              ? vscode.TreeItemCollapsibleState.Expanded
              : vscode.TreeItemCollapsibleState.Collapsed,
          );
        });
    }

    if (type === "story") {
      return this.items
        .filter(
          (i) =>
            (i.data.type === "task" || i.data.type === "bug") &&
            i.data.storyId === id,
        )
        .sort((a, b) => {
          if (a.data.type !== b.data.type) {
            return a.data.type === "bug" ? -1 : 1;
          }
          return a.data.id.localeCompare(b.data.id);
        })
        .map((i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None));
    }

    return [];
  }
}
