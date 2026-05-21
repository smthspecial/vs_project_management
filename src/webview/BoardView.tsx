import React, { useState, useCallback, useMemo, useRef } from "react";
import { ItemData } from "./types";
import { vscode } from "./vscodeApi";

const COLUMNS = [
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "done", label: "Done" },
  { id: "blocked", label: "Blocked" },
];

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

interface CardProps {
  item: ItemData;
  allItems: ItemData[];
  onOpen: (filePath: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

function Card({
  item,
  allItems,
  onOpen,
  onDragStart,
  onDragEnd,
}: CardProps): React.ReactElement {
  const parentLabel = useMemo(() => {
    if (item.storyId) {
      return allItems.find((i) => i.id === item.storyId)?.title ?? item.storyId;
    }
    if (item.epicId) {
      return allItems.find((i) => i.id === item.epicId)?.title ?? item.epicId;
    }
    return null;
  }, [item, allItems]);

  const deps = useMemo(() => {
    if (!item.dependsOn) {
      return [];
    }
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
      {parentLabel && <div className="card-tag">{parentLabel}</div>}
      {deps.length > 0 && (
        <div className="card-deps" title="Depends on">
          🔗 {deps.join(", ")}
        </div>
      )}
    </div>
  );
}

interface BoardViewProps {
  items: ItemData[];
}

export function BoardView({ items }: BoardViewProps): React.ReactElement {
  // Board shows tasks and bugs only; epics/stories are on the Timeline.
  const taskItems = items.filter((i) => i.type === "task" || i.type === "bug");
  const sprintItems = items.filter((i) => i.type === "sprint");
  const releaseItems = items.filter((i) => i.type === "release");

  const [localItems, setLocalItems] = useState<ItemData[]>(taskItems);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [selectedSprint, setSelectedSprint] = useState<string>("all");
  const [selectedRelease, setSelectedRelease] = useState<string>("all");
  const dragIdRef = useRef<string | null>(null);

  React.useEffect(() => {
    setLocalItems(items.filter((i) => i.type === "task" || i.type === "bug"));
  }, [items]);

  const filteredItems = useMemo(() => {
    return localItems.filter((i) => {
      if (selectedSprint !== "all" && i.sprintId !== selectedSprint)
        return false;
      if (selectedRelease !== "all" && i.releaseId !== selectedRelease)
        return false;
      return true;
    });
  }, [localItems, selectedSprint, selectedRelease]);

  const handleStatusChange = useCallback(
    (item: ItemData, newStatus: string) => {
      setLocalItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)),
      );
      vscode.postMessage({
        type: "updateStatus",
        id: item.id,
        status: newStatus,
        filePath: item.filePath,
      });
    },
    [],
  );

  const handleOpen = useCallback((filePath: string) => {
    vscode.postMessage({ type: "openFile", filePath });
  }, []);

  const handleDragStart = useCallback((id: string) => {
    dragIdRef.current = id;
    setDraggingId(id);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragIdRef.current = null;
    setDraggingId(null);
    setDragOverCol(null);
  }, []);

  const handleDrop = useCallback(
    (columnId: string) => {
      const id = dragIdRef.current;
      if (!id) return;
      const item = localItems.find((i) => i.id === id);
      if (item && item.status !== columnId) {
        handleStatusChange(item, columnId);
      }
      setDragOverCol(null);
    },
    [localItems, handleStatusChange],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="board-filters">
        <label>
          Sprint:&nbsp;
          <select
            value={selectedSprint}
            onChange={(e) => setSelectedSprint(e.target.value)}
          >
            <option value="all">All sprints</option>
            {sprintItems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Release:&nbsp;
          <select
            value={selectedRelease}
            onChange={(e) => setSelectedRelease(e.target.value)}
          >
            <option value="all">All releases</option>
            {releaseItems.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="board">
        {COLUMNS.map(({ id, label }) => {
          const cards = filteredItems.filter((i) => i.status === id);
          const isOver = dragOverCol === id;
          return (
            <div
              key={id}
              className={`column${isOver ? " drag-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverCol(id);
              }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(id)}
            >
              <div className="column-header">
                <span>{label}</span>
                <span className="count">{cards.length}</span>
              </div>
              <div className="cards">
                {cards.length === 0 && !isOver ? (
                  <div className="empty">No items</div>
                ) : (
                  cards.map((item) => (
                    <Card
                      key={item.id}
                      item={item}
                      allItems={filteredItems}
                      onOpen={handleOpen}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  ))
                )}
                {isOver && draggingId && <div className="drop-placeholder" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
