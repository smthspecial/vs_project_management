import * as vscode from "vscode";
import { SpecItem } from "./models";
import { parseFrontMatter } from "./specParser";

/**
 * Provides inline lenses above the front-matter of `.spec/**\/*.md` files:
 *  - On Epic files   → shows linked story count
 *  - On FR/NFR files → shows count of linked items
 *  - On story files  → shows linked task/bug counts + parent epic link
 *  - On task/bug files → shows parent story link
 */
export class SpecCodeLensProvider implements vscode.CodeLensProvider {
  constructor(private readonly getItems: () => SpecItem[]) {}

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const { data } = parseFrontMatter(document.getText());
    if (!data.id || !data.type) {
      return [];
    }

    const items = this.getItems();
    const lenses: vscode.CodeLens[] = [];

    // Place all lenses on line 0 (above the front-matter block)
    const range = new vscode.Range(0, 0, 0, 0);

    if (data.type === "fr" || data.type === "nfr") {
      const linkedIds = data.linkedIds
        ? data.linkedIds
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      const linked = items.filter((i) => linkedIds.includes(i.data.id));
      if (linked.length > 0) {
        lenses.push(
          new vscode.CodeLens(range, {
            title: `$(link) ${linked.length} linked ${linked.length === 1 ? "item" : "items"}`,
            command: "project-spec.refresh",
            tooltip: "Stories and tasks linked to this requirement",
          }),
        );
      }
    }

    if (data.type === "epic") {
      const stories = items.filter(
        (i) => i.data.type === "story" && i.data.epicId === data.id,
      );
      lenses.push(
        new vscode.CodeLens(range, {
          title: `$(person) ${stories.length} ${stories.length === 1 ? "story" : "stories"}`,
          command: "project-spec.refresh",
          tooltip: "Stories linked to this epic",
        }),
      );
      if (stories.length > 0) {
        const done = stories.filter((s) => s.data.status === "done").length;
        lenses.push(
          new vscode.CodeLens(range, {
            title: `$(check) ${done}/${stories.length} done`,
            command: "project-spec.refresh",
            tooltip: "Completion status of linked stories",
          }),
        );
      }
    }

    if (data.type === "story") {
      const tasks = items.filter(
        (i) => i.data.type === "task" && i.data.storyId === data.id,
      );
      const bugs = items.filter(
        (i) => i.data.type === "bug" && i.data.storyId === data.id,
      );

      if (tasks.length > 0) {
        lenses.push(
          new vscode.CodeLens(range, {
            title: `$(checklist) ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`,
            command: "project-spec.refresh",
            tooltip: "Tasks linked to this story",
          }),
        );
      }
      if (bugs.length > 0) {
        lenses.push(
          new vscode.CodeLens(range, {
            title: `$(bug) ${bugs.length} ${bugs.length === 1 ? "bug" : "bugs"}`,
            command: "project-spec.refresh",
            tooltip: "Bugs linked to this story",
          }),
        );
      }

      if (data.epicId) {
        const epic = items.find((i) => i.data.id === data.epicId);
        if (epic) {
          lenses.push(
            new vscode.CodeLens(range, {
              title: `$(milestone) Epic: ${epic.data.title}`,
              command: "project-spec.openFile",
              arguments: [epic.filePath],
              tooltip: "Open parent epic",
            }),
          );
        }
      }
    }

    if (data.type === "task" || data.type === "bug") {
      if (data.storyId) {
        const story = items.find((i) => i.data.id === data.storyId);
        if (story) {
          lenses.push(
            new vscode.CodeLens(range, {
              title: `$(person) Story: ${story.data.title}`,
              command: "project-spec.openFile",
              arguments: [story.filePath],
              tooltip: "Open parent user story",
            }),
          );
          if (story.data.epicId) {
            const epic = items.find((i) => i.data.id === story.data.epicId);
            if (epic) {
              lenses.push(
                new vscode.CodeLens(range, {
                  title: `$(milestone) Epic: ${epic.data.title}`,
                  command: "project-spec.openFile",
                  arguments: [epic.filePath],
                  tooltip: "Open parent epic",
                }),
              );
            }
          }
        }
      }
    }

    return lenses;
  }
}
