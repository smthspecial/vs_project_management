import * as fs from "fs";
import { SpecFrontMatter } from "../models";
import { parseFrontMatter, buildFrontMatter } from "../specParser";

// ---------------------------------------------------------------------------
// Patch helper — apply key/value changes to a file's front matter
// ---------------------------------------------------------------------------

export function patchFrontMatter(
  filePath: string,
  patch: Record<string, string>,
): void {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const { data, body } = parseFrontMatter(content);
  // Apply patch onto the parsed data object
  Object.assign(data, patch);
  const updated = buildFrontMatter(data as SpecFrontMatter) + body;
  fs.writeFileSync(filePath, updated, "utf-8");
}

// ---------------------------------------------------------------------------
// Nonce generator for Content-Security-Policy
// ---------------------------------------------------------------------------

export function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
