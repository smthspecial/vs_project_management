import * as vscode from "vscode";
import { SpecItem } from "./models";

/**
 * Ctrl+click navigation for item IDs (e.g. EPIC-001, US-003, TASK-007)
 * anywhere inside .spec/**\/*.md files — front matter or body.
 */
export class SpecDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private readonly getItems: () => SpecItem[]) {}

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Location | null {
    const line = document.lineAt(position).text;
    // Match any ID token like EPIC-001, US-027, TASK-005, BUG-003, etc.
    const idPattern = /\b([A-Z]+-\d+)\b/g;
    let match: RegExpExecArray | null;
    while ((match = idPattern.exec(line)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;
      if (position.character >= start && position.character <= end) {
        const id = match[1];
        // Don't navigate to self
        const items = this.getItems();
        const target = items.find((i) => i.data.id === id);
        if (target) {
          return new vscode.Location(
            vscode.Uri.file(target.filePath),
            new vscode.Position(0, 0),
          );
        }
      }
    }
    return null;
  }
}
