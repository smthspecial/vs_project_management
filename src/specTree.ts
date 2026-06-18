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
  database: "database",
  sprint: "calendar",
  release: "tag",
  member: "account",
  cicd: "settings-gear",
  "auth-spec": "shield",
  concept: "note",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "○",
  active: "●",
  "in-progress": "◑",
  todo: "○",
  testing: "◎",
  done: "✓",
  blocked: "⊘",
  proposed: "?",
  accepted: "✓",
  deprecated: "↓",
  superseded: "↻",
  planned: "◷",
  released: "✓",
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

function inConceptSection(filePath: string, section: string): boolean {
  return filePath.replace(/\\/g, "/").includes(`/concept/${section}/`);
}

// ---------------------------------------------------------------------------
// Tree data provider
// ---------------------------------------------------------------------------

export class SpecTreeDataProvider implements vscode.TreeDataProvider<AnyTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    AnyTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private items: SpecItem[] = [];
  private _loaded = false;
  private _readyPromise: Promise<void>;

  constructor(private rootPath: string) {
    // Defer the initial load so tree views can render their loading state first.
    this._readyPromise = new Promise<void>((resolve) => {
      setImmediate(() => {
        this.load();
        this._loaded = true;
        resolve();
        this._onDidChangeTreeData.fire();
      });
    });
  }

  isLoaded(): boolean {
    return this._loaded;
  }

  waitReady(): Promise<void> {
    return this._readyPromise;
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

  /** Maps a file path to the viewId of the section panel that shows it. */
  findViewIdForFilePath(filePath: string): string | undefined {
    const item = this.items.find((i) => i.filePath === filePath);
    if (!item) {
      return undefined;
    }
    const TYPE_TO_VIEW: Partial<Record<string, string>> = {
      fr: "projectSpecRequirementsTree",
      nfr: "projectSpecRequirementsTree",
      epic: "projectSpecBacklogTree",
      story: "projectSpecBacklogTree",
      task: "projectSpecBacklogTree",
      bug: "projectSpecBacklogTree",
      sprint: "projectSpecSprintsTree",
      release: "projectSpecSprintsTree",
      adr: "projectSpecTechnicalTree",
      arch: "projectSpecTechnicalTree",
      "tech-spec": "projectSpecTechnicalTree",
      cicd: "projectSpecTechnicalTree",
      "auth-spec": "projectSpecTechnicalTree",
      "db-table": "projectSpecDatabaseTree",
      member: "projectSpecTeamTree",
      concept: "projectSpecConceptTree",
    };
    return TYPE_TO_VIEW[item.data.type];
  }

  /** Returns the SpecTreeItem for a file path, or undefined if not found. */
  findTreeItemForFilePath(filePath: string): SpecTreeItem | undefined {
    const item = this.items.find((i) => i.filePath === filePath);
    if (!item) {
      return undefined;
    }
    return new SpecTreeItem(item, vscode.TreeItemCollapsibleState.None);
  }

  getTreeItem(element: AnyTreeItem): vscode.TreeItem {
    return element;
  }

  /** Returns children for a given group id — used by section panels and group expansion. */
  getGroupChildren(groupId: string): AnyTreeItem[] {
    switch (groupId) {
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
      case "backlog":
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
      case "sprints-releases":
        return [
          new TreeGroupItem("sprints", "Sprints", "calendar"),
          new TreeGroupItem("releases", "Releases", "tag"),
        ];
      case "sprints":
        return this.items
          .filter((i) => i.data.type === "sprint")
          .sort((a, b) => a.data.id.localeCompare(b.data.id))
          .map((i) => {
            const hasStories = this.items.some(
              (s) =>
                (s.data.type === "story" ||
                  s.data.type === "task" ||
                  s.data.type === "bug") &&
                s.data.sprintId === i.data.id,
            );
            return new SpecTreeItem(
              i,
              hasStories
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
            );
          });
      case "releases":
        return this.items
          .filter((i) => i.data.type === "release")
          .sort((a, b) => a.data.id.localeCompare(b.data.id))
          .map(
            (i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None),
          );
      case "technical":
        return [
          new TreeGroupItem("adr", "Architectural Decisions", "history"),
          new TreeGroupItem("arch", "Architecture Design", "layout"),
          new TreeGroupItem("spec", "Services", "file-code"),
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
        return [
          new TreeGroupItem("arch-docs", "Architecture Docs", "layout"),
          new TreeGroupItem("cicd", "CI/CD", "settings-gear"),
          new TreeGroupItem("auth-spec", "Roles & Authorization", "shield"),
        ];
      case "arch-docs":
        return this.items
          .filter((i) => i.data.type === "arch")
          .sort((a, b) => a.data.id.localeCompare(b.data.id))
          .map(
            (i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None),
          );
      case "spec":
        return this.items
          .filter(
            (i) => i.data.type === "tech-spec" && !i.data.id.startsWith("DB-"),
          )
          .sort((a, b) => a.data.id.localeCompare(b.data.id))
          .map(
            (i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None),
          );
      case "database":
        return this.items
          .filter((i) => i.data.type === "db-table")
          .sort((a, b) => a.data.id.localeCompare(b.data.id))
          .map(
            (i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None),
          );
      case "cicd":
        return this.items
          .filter((i) => i.data.type === "cicd")
          .sort((a, b) => a.data.id.localeCompare(b.data.id))
          .map(
            (i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None),
          );
      case "auth-spec":
        return this.items
          .filter((i) => i.data.type === "auth-spec")
          .sort((a, b) => a.data.id.localeCompare(b.data.id))
          .map(
            (i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None),
          );
      case "team":
        // Members shown directly — no sub-group folder
        return this.items
          .filter((i) => i.data.type === "member")
          .sort((a, b) => a.data.id.localeCompare(b.data.id))
          .map(
            (i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None),
          );
      case "concept":
        return [
          new TreeGroupItem("concept-history", "History & Problem", "history"),
          new TreeGroupItem("concept-goals", "Goals", "target"),
          new TreeGroupItem("concept-principles", "Core Principles", "book"),
          new TreeGroupItem("concept-risks", "Risks & Obstacles", "warning"),
          new TreeGroupItem("concept-sysdesign", "System Design", "layout"),
          new TreeGroupItem("concept-sysimpl", "System Implementation", "wrench"),
        ];
      case "concept-history":
        return this.items
          .filter((i) => i.data.type === "concept" && inConceptSection(i.filePath, "history"))
          .sort((a, b) => a.data.id.localeCompare(b.data.id))
          .map((i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None));
      case "concept-goals":
        return this.items
          .filter((i) => i.data.type === "concept" && inConceptSection(i.filePath, "goals"))
          .sort((a, b) => a.data.id.localeCompare(b.data.id))
          .map((i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None));
      case "concept-principles":
        return this.items
          .filter((i) => i.data.type === "concept" && inConceptSection(i.filePath, "principles"))
          .sort((a, b) => a.data.id.localeCompare(b.data.id))
          .map((i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None));
      case "concept-risks":
        return this.items
          .filter((i) => i.data.type === "concept" && inConceptSection(i.filePath, "risks"))
          .sort((a, b) => a.data.id.localeCompare(b.data.id))
          .map((i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None));
      case "concept-sysdesign":
        return this.items
          .filter((i) => i.data.type === "concept" && inConceptSection(i.filePath, "sysdesign"))
          .sort((a, b) => a.data.id.localeCompare(b.data.id))
          .map((i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None));
      case "concept-sysimpl":
        return this.items
          .filter((i) => i.data.type === "concept" && inConceptSection(i.filePath, "sysimpl"))
          .sort((a, b) => a.data.id.localeCompare(b.data.id))
          .map((i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None));
      default:
        return [];
    }
  }

  getChildren(element?: AnyTreeItem): AnyTreeItem[] {
    if (!element) {
      // Not used when section panels are registered — SectionTreeAdapter handles root.
      return [];
    }

    if (element instanceof TreeGroupItem) {
      return this.getGroupChildren(element.groupId);
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

    if (type === "sprint") {
      return this.items
        .filter(
          (i) =>
            (i.data.type === "story" ||
              i.data.type === "task" ||
              i.data.type === "bug") &&
            i.data.sprintId === id,
        )
        .sort((a, b) => a.data.id.localeCompare(b.data.id))
        .map((i) => new SpecTreeItem(i, vscode.TreeItemCollapsibleState.None));
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

// ---------------------------------------------------------------------------
// Section tree adapter — thin wrapper used for each side panel
// ---------------------------------------------------------------------------

export class SectionTreeAdapter implements vscode.TreeDataProvider<AnyTreeItem> {
  private _emitter = new vscode.EventEmitter<
    AnyTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._emitter.event;

  constructor(
    private readonly master: SpecTreeDataProvider,
    public readonly section: string,
  ) {}

  fire(): void {
    this._emitter.fire();
  }

  getTreeItem(element: AnyTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AnyTreeItem): AnyTreeItem[] | Promise<AnyTreeItem[]> {
    if (!element) {
      if (!this.master.isLoaded()) {
        return this.master
          .waitReady()
          .then(() => this.master.getGroupChildren(this.section));
      }
      return this.master.getGroupChildren(this.section);
    }
    return this.master.getChildren(element);
  }

  getParent(element: AnyTreeItem): AnyTreeItem | undefined {
    if (element instanceof TreeGroupItem) {
      // Second-level groups nested under "arch"
      if (
        element.groupId === "arch-docs" ||
        element.groupId === "cicd" ||
        element.groupId === "auth-spec"
      ) {
        return new TreeGroupItem("arch", "Architecture Design", "layout");
      }
      return undefined; // top-level groups have no parent
    }

    // SpecTreeItem — parent depends on the section this adapter serves
    const { type } = element.spec.data;
    const items = this.master.getAllItems();

    switch (this.section) {
      case "requirements":
        if (type === "fr") {
          return new TreeGroupItem(
            "fr",
            "Functional Requirements",
            "symbol-interface",
          );
        }
        if (type === "nfr") {
          return new TreeGroupItem(
            "nfr",
            "Non-Functional Requirements",
            "symbol-property",
          );
        }
        break;

      case "backlog": {
        if (type === "story" && element.spec.data.epicId) {
          const epic = items.find(
            (i) => i.data.id === element.spec.data.epicId,
          );
          if (epic) {
            return new SpecTreeItem(
              epic,
              vscode.TreeItemCollapsibleState.Expanded,
            );
          }
        }
        if ((type === "task" || type === "bug") && element.spec.data.storyId) {
          const story = items.find(
            (i) => i.data.id === element.spec.data.storyId,
          );
          if (story) {
            return new SpecTreeItem(
              story,
              vscode.TreeItemCollapsibleState.Expanded,
            );
          }
        }
        break;
      }

      case "sprints-releases":
        if (type === "sprint") {
          return new TreeGroupItem("sprints", "Sprints", "calendar");
        }
        if (type === "release") {
          return new TreeGroupItem("releases", "Releases", "tag");
        }
        if (
          (type === "story" || type === "task" || type === "bug") &&
          element.spec.data.sprintId
        ) {
          const sprint = items.find(
            (i) => i.data.id === element.spec.data.sprintId,
          );
          if (sprint) {
            return new SpecTreeItem(
              sprint,
              vscode.TreeItemCollapsibleState.Expanded,
            );
          }
        }
        break;

      case "technical":
        if (type === "adr") {
          return new TreeGroupItem("adr", "Architectural Decisions", "history");
        }
        if (type === "arch") {
          return new TreeGroupItem("arch-docs", "Architecture Docs", "layout");
        }
        if (type === "tech-spec") {
          return new TreeGroupItem("spec", "Services", "file-code");
        }
        if (type === "cicd") {
          return new TreeGroupItem("cicd", "CI/CD", "settings-gear");
        }
        if (type === "auth-spec") {
          return new TreeGroupItem(
            "auth-spec",
            "Roles & Authorization",
            "shield",
          );
        }
        break;

      case "concept": {
        const { type: cType } = element.spec.data;
        if (cType !== "concept") {
          break;
        }
        const fp = element.spec.filePath;
        if (inConceptSection(fp, "history")) {
          return new TreeGroupItem("concept-history", "History & Problem", "history");
        }
        if (inConceptSection(fp, "goals")) {
          return new TreeGroupItem("concept-goals", "Goals", "target");
        }
        if (inConceptSection(fp, "principles")) {
          return new TreeGroupItem("concept-principles", "Core Principles", "book");
        }
        if (inConceptSection(fp, "risks")) {
          return new TreeGroupItem("concept-risks", "Risks & Obstacles", "warning");
        }
        if (inConceptSection(fp, "sysdesign")) {
          return new TreeGroupItem("concept-sysdesign", "System Design", "layout");
        }
        if (inConceptSection(fp, "sysimpl")) {
          return new TreeGroupItem("concept-sysimpl", "System Implementation", "wrench");
        }
        break;
      }

      // "database" and "team": items sit at root level, no parent
    }

    return undefined;
  }
}
