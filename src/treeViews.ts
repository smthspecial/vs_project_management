import * as vscode from "vscode";
import {
  SpecTreeDataProvider,
  SectionTreeAdapter,
  AnyTreeItem,
} from "./specTree";

const SECTION_DEFS: { viewId: string; section: string }[] = [
  { viewId: "projectSpecRequirementsTree", section: "requirements" },
  { viewId: "projectSpecBacklogTree", section: "backlog" },
  { viewId: "projectSpecSprintsTree", section: "sprints-releases" },
  { viewId: "projectSpecTechnicalTree", section: "technical" },
  { viewId: "projectSpecDatabaseTree", section: "database" },
  { viewId: "projectSpecTeamTree", section: "team" },
  { viewId: "projectSpecConceptTree", section: "concept" },
];

// One sidebar tree view per section, kept in sync with the shared provider,
// plus the "reveal this file in its panel" command CodeLens/definitions use
// to jump from a .spec/**/*.md file to its tree entry.
export function registerSectionTreeViews(
  context: vscode.ExtensionContext,
  provider: SpecTreeDataProvider,
): void {
  const adapters = SECTION_DEFS.map(
    ({ section }) => new SectionTreeAdapter(provider, section),
  );

  const treeViews = new Map<string, vscode.TreeView<AnyTreeItem>>();
  SECTION_DEFS.forEach(({ viewId }, i) => {
    const adapter = adapters[i]!;
    const treeView = vscode.window.createTreeView(viewId, {
      treeDataProvider: adapter,
      showCollapseAll: true,
    });
    treeViews.set(viewId, treeView);
    context.subscriptions.push(treeView);
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "project-spec._revealInTree",
      async (filePath: string) => {
        const viewId = provider.findViewIdForFilePath(filePath);
        const treeItem = provider.findTreeItemForFilePath(filePath);
        const treeView = viewId ? treeViews.get(viewId) : undefined;
        if (!treeView || !treeItem) {
          return;
        }
        try {
          await treeView.reveal(treeItem, {
            select: true,
            focus: false,
            expand: true,
          });
        } catch {
          // item may not be visible yet — ignore
        }
      },
    ),
  );

  context.subscriptions.push(
    provider.onDidChangeTreeData(() => {
      adapters.forEach((a) => a.fire());
    }),
  );
}
