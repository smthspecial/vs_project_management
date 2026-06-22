import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getSpecDir } from "../specParser";
import migration001 from "./001-arch-to-technical-arch";

export interface Migration {
  id: string;
  description: string;
  run(specDir: string): Promise<{ moved: string[] }>;
}

const ALL_MIGRATIONS: Migration[] = [migration001];

const MIGRATIONS_FILE = ".migrations.json";

function loadApplied(specDir: string): string[] {
  const filePath = path.join(specDir, MIGRATIONS_FILE);
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveApplied(specDir: string, applied: string[]): void {
  fs.writeFileSync(
    path.join(specDir, MIGRATIONS_FILE),
    JSON.stringify(applied, null, 2) + "\n",
  );
}

export async function runPendingMigrations(
  rootPath: string,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  if (!rootPath) {
    return;
  }

  const specDir = getSpecDir(rootPath);
  if (!fs.existsSync(specDir)) {
    return;
  }

  const applied = loadApplied(specDir);
  const pending = ALL_MIGRATIONS.filter((m) => !applied.includes(m.id));

  if (pending.length === 0) {
    return;
  }

  const allMoved: string[] = [];

  for (const migration of pending) {
    try {
      outputChannel.appendLine(`Running migration: ${migration.id} — ${migration.description}`);
      const result = await migration.run(specDir);
      applied.push(migration.id);
      saveApplied(specDir, applied);

      if (result.moved.length > 0) {
        result.moved.forEach((f) => outputChannel.appendLine(`  Moved: ${f}`));
        allMoved.push(...result.moved);
      } else {
        outputChannel.appendLine(`  Nothing to migrate.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(`  ERROR: ${msg}`);
      vscode.window.showErrorMessage(
        `Project Spec migration "${migration.id}" failed: ${msg}`,
      );
    }
  }

  if (allMoved.length > 0) {
    const action = await vscode.window.showInformationMessage(
      `Project Spec: migrated ${allMoved.length} file(s) to updated folder structure.`,
      "Show Details",
    );
    if (action === "Show Details") {
      outputChannel.show(true);
    }
  }
}
