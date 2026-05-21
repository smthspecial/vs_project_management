import React, { useMemo } from "react";
import { ItemData } from "../types";

const TYPE_COLOR: Record<string, string> = {
  epic: "var(--vscode-charts-purple)",
  story: "var(--vscode-charts-blue)",
  task: "var(--vscode-charts-green)",
  bug: "var(--vscode-charts-red)",
  fr: "var(--vscode-charts-orange)",
  nfr: "var(--vscode-charts-yellow)",
};

const PRIORITY_ICON: Record<string, string> = {
  high: "↑",
  medium: "–",
  low: "↓",
};

function badge(type: string): React.ReactElement {
  const color = TYPE_COLOR[type] ?? "var(--vscode-foreground)";
  return (
    <span
      style={{
        color,
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: 0.5,
        textTransform: "uppercase",
      }}
    >
      {type}
    </span>
  );
}

interface BoardCardProps {
  item: ItemData;
  allItems: ItemData[];
  onOpen: (filePath: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

export function BoardCard({
  item,
  allItems,
  onOpen,
  onDragStart,
  onDragEnd,
}: BoardCardProps): React.ReactElement {
  const parentLabel = useMemo(() => {
    if (item.storyId) {
      const story = allItems.find((i) => i.id === item.storyId);
      return story
        ? { id: story.id, title: story.title, kind: "story" as const }
        : { id: item.storyId, title: item.storyId, kind: "story" as const };
    }
    if (item.epicId) {
      const epic = allItems.find((i) => i.id === item.epicId);
      return epic
        ? { id: epic.id, title: epic.title, kind: "epic" as const }
        : { id: item.epicId, title: item.epicId, kind: "epic" as const };
    }
    return null;
  }, [item, allItems]);

  const assigneeName = useMemo(() => {
    if (!item.assigneeId) return null;
    return (
      allItems.find((i) => i.id === item.assigneeId)?.title ?? item.assigneeId
    );
  }, [item, allItems]);

  const deps = useMemo(() => {
    if (!item.dependsOn) return [];
    return item.dependsOn
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => allItems.find((i) => i.id === id)?.title ?? id);
  }, [item, allItems]);

  return (
    <div
      className="card"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(item.id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(item.filePath)}
      title={`${item.id}: ${item.title}`}
    >
      <div className="card-header">
        {badge(item.type)}
        {item.priority && (
          <span className="priority" title={item.priority}>
            {PRIORITY_ICON[item.priority] ?? ""}
          </span>
        )}
        <span className="card-status">{item.status}</span>
      </div>
      <div className="card-title">{item.title}</div>
      <div className="card-id">{item.id}</div>
      {parentLabel && (
        <div
          className="card-tag"
          title={`${parentLabel.kind === "story" ? "Story" : "Epic"}: ${parentLabel.id} — ${parentLabel.title}`}
        >
          {parentLabel.kind === "story" ? "📖" : "🎯"} {parentLabel.id}:{" "}
          {parentLabel.title}
        </div>
      )}
      {assigneeName && (
        <div className="card-assignee" title={`Assignee: ${assigneeName}`}>
          👤 {assigneeName}
        </div>
      )}
      {deps.length > 0 && (
        <div className="card-deps" title="Depends on">
          🔗 {deps.join(", ")}
        </div>
      )}
    </div>
  );
}
