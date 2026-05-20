import React, { useState, useCallback, useMemo, useRef } from "react";
import { ItemData } from "./types";
import { vscode } from "./vscodeApi";

const COLUMNS = [
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "done", label: "Done" },
  { id: "closed", label: "Closed" },
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
  onStatusChange: (item: ItemData, newStatus: string) => void;
  availableStatuses: string[];
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

function Card({
  item,
  allItems,
  onOpen,
  onStatusChange,
  availableStatuses,
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
        <select
          className="status-select"
          value={item.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            onStatusChange(item, e.target.value);
          }}
        >
          {availableStatuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
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

  const [localItems, setLocalItems] = useState<ItemData[]>(taskItems);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);

  React.useEffect(() => {
    setLocalItems(items.filter((i) => i.type === "task" || i.type === "bug"));
  }, [items]);

  const getStatuses = useCallback((_item: ItemData): string[] => {
    return ["todo", "in-progress", "done", "closed"];
  }, []);

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
    <div className="board">
      {COLUMNS.map(({ id, label }) => {
        const cards = localItems.filter((i) => i.status === id);
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
                    allItems={localItems}
                    onOpen={handleOpen}
                    onStatusChange={handleStatusChange}
                    availableStatuses={getStatuses(item)}
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
  );
}
