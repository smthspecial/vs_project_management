import * as vscode from "vscode";
import * as fs from "fs";
import { PlanningPanel, patchFrontMatter } from "./panels";
import type { SpecTreeDataProvider } from "./specTree";

// Keeps the "has any epics" context key and the Planning webview panel (if
// open) in sync with the tree, and registers the commands that open it
// directly to a given tab (Board / Timeline / Database).
export function registerPlanningCommands(
  context: vscode.ExtensionContext,
  provider: SpecTreeDataProvider,
): void {
  const syncPlanningState = (): void => {
    const items = provider.getAllItems();
    const hasEpic = items.some((i) => i.data.type === "epic");
    vscode.commands.executeCommand("setContext", "projectSpec.hasEpic", hasEpic);
    PlanningPanel.update(items);
  };

  const makeOpenHandler = (view: string) => () => {
    PlanningPanel.createOrShow(
      context,
      provider.getAllItems(),
      (filePath, patch) => {
        patchFrontMatter(filePath, patch);
        provider.refresh();
      },
      (filePath) => {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          vscode.window.showErrorMessage(
            `Failed to delete file: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
        provider.refresh();
      },
      view,
    );
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "project-spec.openBoard",
      makeOpenHandler("board"),
    ),
    vscode.commands.registerCommand(
      "project-spec.openTimeline",
      makeOpenHandler("timeline"),
    ),
    vscode.commands.registerCommand(
      "project-spec.openDatabase",
      makeOpenHandler("database"),
    ),
  );

  context.subscriptions.push(
    provider.onDidChangeTreeData(() => syncPlanningState()),
  );
  syncPlanningState();
}
