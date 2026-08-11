import * as vscode from "vscode";
import type { SpecTreeDataProvider } from "../specTree";
import { registerSpecTool } from "./specTool";
import {
  registerInstructionFileCommands,
  autoWriteInstructionFiles,
} from "./instructionFiles";

// Everything AI-facing: the vscode.lm tools Copilot can call directly, and
// the commands that (re)generate Copilot/Claude/Codex instruction files.
// See src/ai/*.ts for the individual pieces.
export function registerAiFeatures(
  context: vscode.ExtensionContext,
  provider: SpecTreeDataProvider,
  getRootPath: () => string | undefined,
): void {
  registerSpecTool(context, provider);
  registerInstructionFileCommands(context, getRootPath);
  autoWriteInstructionFiles(getRootPath());
}
