import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ItemData } from "./types";
import { vscode } from "./vscodeApi";
import { useBoardDrag } from "./hooks/useBoardDrag";
import { BoardColumn } from "./components/BoardColumn";

const COLUMNS = [
  { id: "todo", label: "To Do" },
  { id: "in-progress", label: "In Progress" },
  { id: "testing", label: "Testing" },
  { id: "done", label: "Done" },
  { id: "blocked", label: "Blocked" },
];

interface BoardViewProps {
  items: ItemData[];
}

export function BoardView({ items }: BoardViewProps): React.ReactElement {
  const taskItems = items.filter((i) => i.type === "task" || i.type === "bug");
  const sprintItems = items.filter((i) => i.type === "sprint");
  const releaseItems = items.filter((i) => i.type === "release");
  const memberItems = items.filter((i) => i.type === "member");

  const [localItems, setLocalItems] = useState<ItemData[]>(taskItems);
  const [selectedSprint, setSelectedSprint] = useState<string>("all");
  const [selectedRelease, setSelectedRelease] = useState<string>("all");
  const [selectedMember, setSelectedMember] = useState<string>("all");

  useEffect(() => {
    setLocalItems(items.filter((i) => i.type === "task" || i.type === "bug"));
  }, [items]);

  const {
    draggingId,
    dragOverCol,
    setDragOverCol,
    handleDragStart,
    handleDragEnd,
    handleDrop,
  } = useBoardDrag(localItems, setLocalItems);

  const filteredItems = useMemo(
    () =>
      localItems.filter((i) => {
        if (selectedSprint !== "all" && i.sprintId !== selectedSprint)
          return false;
        if (selectedRelease !== "all" && i.releaseId !== selectedRelease)
          return false;
        if (selectedMember !== "all" && i.assigneeId !== selectedMember)
          return false;
        return true;
      }),
    [localItems, selectedSprint, selectedRelease, selectedMember],
  );

  const handleOpen = useCallback((filePath: string) => {
    vscode.postMessage({ type: "openFile", filePath });
  }, []);

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
        <label>
          Member:&nbsp;
          <select
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
          >
            <option value="all">All members</option>
            {memberItems.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
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
            <BoardColumn
              key={id}
              id={id}
              label={label}
              cards={cards}
              allItems={filteredItems}
              isOver={isOver}
              draggingId={draggingId}
              onOpen={handleOpen}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverCol(id);
              }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(id)}
            />
          );
        })}
      </div>
    </div>
  );
}
