import * as vscode from "vscode";
import { SpecTreeDataProvider } from "./specTree";
import { registerCommands } from "./commands";
import { runPendingMigrations } from "./migrations";
import { registerAiFeatures } from "./ai";
import { registerSectionTreeViews } from "./treeViews";
import { registerCodeNavigation } from "./codeNavigation";
import { registerPlanningCommands } from "./planningCommands";
import { registerSyncPanel } from "./syncPanel";
import {
  registerSpecFileWatcher,
  registerWorkspaceFolderChangeHandler,
} from "./workspaceWatchers";

function getRootPath(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function runSpecMigrations(
  rootPath: string,
  outputChannel: vscode.OutputChannel,
): void {
  if (!rootPath) {
    return;
  }
  runPendingMigrations(rootPath, outputChannel).catch((err) => {
    outputChannel.appendLine(
      `Migration error: ${err instanceof Error ? err.message : String(err)}`,
    );
  });
}

export function activate(context: vscode.ExtensionContext): void {
  // Use a placeholder root; provider handles missing workspace gracefully
  const rootPath = getRootPath() ?? "";

  const outputChannel = vscode.window.createOutputChannel("Project Spec");
  context.subscriptions.push(outputChannel);
  runSpecMigrations(rootPath, outputChannel);

  const provider = new SpecTreeDataProvider(rootPath);

  registerSectionTreeViews(context, provider);
  registerCommands(context, provider, getRootPath);
  registerPlanningCommands(context, provider);
  registerCodeNavigation(context, provider);
  registerAiFeatures(context, provider, getRootPath);

  registerSpecFileWatcher(context, rootPath, provider);
  const sync = registerSyncPanel(context, getRootPath, rootPath, provider);
  registerWorkspaceFolderChangeHandler(context, getRootPath, provider, sync);
}

export function deactivate(): void {}
