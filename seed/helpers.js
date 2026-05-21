"use strict";
const fs = require("fs");
const path = require("path");

function fm(fields) {
  const lines = ["---"];
  lines.push(`id: ${fields.id}`);
  lines.push(`type: ${fields.type}`);
  lines.push(`title: "${fields.title.replace(/"/g, '\\"')}"`);
  lines.push(`status: ${fields.status}`);
  if (fields.epicId) lines.push(`epicId: ${fields.epicId}`);
  if (fields.storyId) lines.push(`storyId: ${fields.storyId}`);
  if (fields.linkedIds) lines.push(`linkedIds: ${fields.linkedIds}`);
  if (fields.dependsOn) lines.push(`dependsOn: ${fields.dependsOn}`);
  if (fields.sprintId) lines.push(`sprintId: ${fields.sprintId}`);
  if (fields.releaseId) lines.push(`releaseId: ${fields.releaseId}`);
  if (fields.startDate) lines.push(`startDate: ${fields.startDate}`);
  if (fields.dueDate) lines.push(`dueDate: ${fields.dueDate}`);
  if (fields.releaseDate) lines.push(`releaseDate: ${fields.releaseDate}`);
  if (fields.relations) lines.push(`relations: ${fields.relations}`);
  if (fields.priority) lines.push(`priority: ${fields.priority}`);
  lines.push(`created: ${fields.created || "2026-05-01"}`);
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

function makeWrite(specRoot, root) {
  return function write(relPath, content) {
    const abs = path.join(specRoot, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf-8");
    console.log("  created:", path.relative(root, abs));
  };
}

module.exports = { fm, makeWrite };
