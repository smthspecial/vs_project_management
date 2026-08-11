import * as vscode from "vscode";
import { SpecCodeLensProvider } from "./codeLens";
import { SpecDefinitionProvider } from "./definitionProvider";
import { registerHoverProvider } from "./hoverProvider";
import type { SpecTreeDataProvider } from "./specTree";

const SPEC_MARKDOWN_SELECTOR: vscode.DocumentFilter = {
  language: "markdown",
  pattern: "**/.spec/**/*.md",
};

// Editor affordances inside .spec/**/*.md files: CodeLens actions above the
// front matter, Ctrl+click navigation for item IDs (EPIC-001, US-003, …),
// and hover docs for front-matter field keys.
export function registerCodeNavigation(
  context: vscode.ExtensionContext,
  provider: SpecTreeDataProvider,
): void {
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      SPEC_MARKDOWN_SELECTOR,
      new SpecCodeLensProvider(() => provider.getAllItems()),
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      SPEC_MARKDOWN_SELECTOR,
      new SpecDefinitionProvider(() => provider.getAllItems()),
    ),
  );

  registerHoverProvider(context, () => provider.getAllItems());
}
